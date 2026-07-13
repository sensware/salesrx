import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.SALESRX_MODEL || "claude-sonnet-5";
export const MAX_SEARCHES = Number(process.env.SALESRX_MAX_WEB_SEARCHES) || 8;

export function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set (see .env.example)");
  return new Anthropic({ apiKey });
}

/** Extract the final JSON object/array from a model response that may contain prose or fences. */
export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = Math.min(
    ...[cleaned.indexOf("{"), cleaned.indexOf("[")].filter((i) => i >= 0)
  );
  const lastBrace = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (!isFinite(start) || lastBrace < 0) throw new Error("No JSON in model response");
  return JSON.parse(cleaned.slice(start, lastBrace + 1)) as T;
}

/** Concatenate all text blocks of a message. */
export function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
