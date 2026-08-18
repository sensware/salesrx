import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.SALESRX_MODEL || "claude-sonnet-5";
export const MAX_SEARCHES = Number(process.env.SALESRX_MAX_WEB_SEARCHES) || 8;

export function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set (see .env.example)");
  return new Anthropic({ apiKey });
}

/** The model produced text that isn't valid JSON — usually worth a retry, not a hard failure. */
export class JsonFormatError extends Error {}

/** Find the end of the JSON value starting at `start`, respecting string/escape boundaries. */
function matchingBraceEnd(text: string, start: number): number {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++; // skip escaped char
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return i;
  }
  return -1;
}

/** Extract the final JSON object/array from a model response that may contain prose or fences. */
export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, "").trim();

  // Fast path: the whole response is already valid JSON.
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // fall through to boundary scanning below
  }

  const start = Math.min(
    ...[cleaned.indexOf("{"), cleaned.indexOf("[")].filter((i) => i >= 0)
  );
  if (!isFinite(start)) throw new JsonFormatError("No JSON found in model response");
  const end = matchingBraceEnd(cleaned, start);
  const slice = end >= 0 ? cleaned.slice(start, end + 1) : cleaned.slice(start);

  try {
    return JSON.parse(slice) as T;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new JsonFormatError(`Model returned malformed JSON (${reason})`);
  }
}

/** Concatenate all text blocks of a message. */
export function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
