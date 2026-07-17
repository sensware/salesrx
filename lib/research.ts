/** Core research pipeline — shared by /api/research and calendar auto-prep. */
import { client, MODEL, MAX_SEARCHES, extractJson, textOf } from "./anthropic";
import { researchSystemPrompt, researchUserPrompt } from "./prompts";
import { getStructuredSignals, signalsToPromptBlock } from "./theirstack";
import { getOrCreateAccount, updateAccount, memoryToPromptBlock } from "./accounts";
import { cacheGet, cacheSet } from "./cache";
import type { Brief, ProspectInput, RepProfile } from "./types";

export function briefCacheKey(
  profile: RepProfile,
  prospect: ProspectInput,
  workspaceId: string
): string {
  return `brief:${workspaceId}|${prospect.name}|${prospect.domain}|${prospect.contact}|${profile?.moat}`;
}

export async function runResearch(
  profile: RepProfile,
  prospect: ProspectInput,
  workspaceId = "local"
): Promise<{ brief: Brief; cached: boolean }> {
  const cacheKey = briefCacheKey(profile, prospect, workspaceId);
  const cached = await cacheGet<Brief>(cacheKey);
  if (cached) return { brief: cached, cached: true };

  // v1.1: structured hiring + technographic signals (optional, key-gated)
  const structured = await getStructuredSignals(prospect);
  const structuredBlock = structured ? signalsToPromptBlock(structured) : undefined;

  // v1.2/v2.0: workspace-shared account memory
  const account = await getOrCreateAccount(prospect.name, prospect.domain, workspaceId);
  const memoryBlock = memoryToPromptBlock(account);

  const anthropic = client();
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: researchSystemPrompt(),
    messages: [
      {
        role: "user",
        content: researchUserPrompt(profile, prospect, structuredBlock, memoryBlock),
      },
    ],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }],
  });

  const brief = extractJson<Brief>(textOf(msg));
  await cacheSet(cacheKey, brief);

  account.briefsRun += 1;
  account.lastBriefAt = new Date().toISOString();
  await updateAccount(account, workspaceId);

  return { brief, cached: false };
}
