/** Core research pipeline — shared by /api/research and calendar auto-prep. */
import Anthropic from "@anthropic-ai/sdk";
import { client, MODEL, MAX_SEARCHES, extractJson, textOf, JsonFormatError } from "./anthropic";
import { researchSystemPrompt, researchUserPrompt } from "./prompts";
import { getStructuredSignals, signalsToPromptBlock } from "./theirstack";
import { primarySourcesBlock } from "./primary-sources";
import { getOrCreateAccount, updateAccount, memoryToPromptBlock } from "./accounts";
import { cacheGet, cacheSet } from "./cache";
import { consume } from "./usage";
import type { Ctx } from "./auth";
import type { Brief, ProspectInput, RepProfile } from "./types";

export function briefCacheKey(
  profile: RepProfile,
  prospect: ProspectInput,
  workspaceId: string
): string {
  return `brief:${workspaceId}|${prospect.name}|${prospect.domain}|${prospect.contact}|${profile?.moat}`;
}

async function requestBrief(anthropic: Anthropic, userPrompt: string): Promise<Brief> {
  // Streamed: max_tokens this large, combined with a multi-round web-search
  // tool loop, can genuinely run past the SDK's non-streaming safety timeout.
  const stream = anthropic.messages.stream({
    model: MODEL,
    // Sonnet 5 thinks adaptively by default, and thinking shares this budget
    // with the JSON output — 8000 was too tight and caused silent truncation
    // on evidence-heavy briefs. effort:medium keeps latency reasonable since
    // the model is grounding claims in web_search results, not pure reasoning.
    max_tokens: 24000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: researchSystemPrompt(),
    messages: [{ role: "user", content: userPrompt }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "max_tokens") {
    throw new JsonFormatError("Response was cut off before the JSON finished (hit max_tokens)");
  }
  const text = textOf(msg);
  try {
    return extractJson<Brief>(text);
  } catch (err) {
    console.error(
      "[research] JSON parse failed — stop_reason:",
      msg.stop_reason,
      "length:",
      text.length,
      "error:",
      err instanceof Error ? err.message : err
    );
    throw err;
  }
}

/** One retry on malformed JSON — the model occasionally slips up on formatting
 *  (e.g. an unescaped quote inside a verbatim excerpt), and a second try clears
 *  almost all of these. */
export async function requestBriefWithRetry(anthropic: Anthropic, userPrompt: string): Promise<Brief> {
  try {
    return await requestBrief(anthropic, userPrompt);
  } catch (err) {
    if (!(err instanceof JsonFormatError)) throw err;
    return requestBrief(anthropic, userPrompt);
  }
}

export async function runResearch(
  profile: RepProfile,
  prospect: ProspectInput,
  workspaceId = "local",
  consumeFor?: Ctx
): Promise<{ brief: Brief; cached: boolean }> {
  const cacheKey = briefCacheKey(profile, prospect, workspaceId);
  const cached = await cacheGet<Brief>(cacheKey);
  if (cached) return { brief: cached, cached: true };

  // v2.2: fresh research consumes a brief credit (cached hits above are free)
  if (consumeFor) await consume(consumeFor, "briefs");

  // v1.1: structured hiring + technographic signals (optional, key-gated)
  // v2.1: primary sources — SEC filings, press coverage, earnings-call excerpts
  // v1.2/v2.0: workspace-shared account memory
  // These are all independent lookups, so run them together instead of in sequence.
  const [structured, primary, account] = await Promise.all([
    getStructuredSignals(prospect),
    primarySourcesBlock(prospect, profile),
    getOrCreateAccount(prospect.name, prospect.domain, workspaceId),
  ]);
  const structuredBlock =
    [structured ? signalsToPromptBlock(structured) : undefined, primary]
      .filter(Boolean)
      .join("\n\n") || undefined;
  const memoryBlock = memoryToPromptBlock(account);

  const anthropic = client();
  const userPrompt = researchUserPrompt(profile, prospect, structuredBlock, memoryBlock);

  const brief = await requestBriefWithRetry(anthropic, userPrompt);
  await cacheSet(cacheKey, brief);

  account.briefsRun += 1;
  account.lastBriefAt = new Date().toISOString();
  await updateAccount(account, workspaceId);

  return { brief, cached: false };
}
