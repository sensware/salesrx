import test from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { briefCacheKey, requestBriefWithRetry } from "./research";
import { JsonFormatError } from "./anthropic";
import type { Brief, ProspectInput, RepProfile } from "./types";

// Real parameters from a live session that reproduced the "malformed JSON" bug.
const profile: RepProfile = {
  industry: "IT Consulting",
  vertical: "IT Channel partner, trusted advisor cloud, data ,connectivity, cyber & SAAS",
  productType: "IT Consulting ",
  location: "Midwest ",
  competitors: "aws, microsoft, deloitte, ",
  moat: "25 years of experience in IT",
};

const prospect: ProspectInput = {
  name: "Richards Building Supply",
  domain: "https://www.richards-supply.com/",
  location: "",
  contact: "",
};

const validBrief: Brief = {
  company: "Richards Building Supply",
  meta: "richards-supply.com · Midwest · Building products distribution",
  tags: ["distribution"],
  fitScore: 62,
  fitBreakdown: [{ label: "ICP match", score: 20, max: 30 }],
  summary: "ok",
  signals: [],
  stack: [],
  incumbent: "",
  stackNote: "",
  challenges: [],
  painPoints: [],
  people: [],
  rapport: [],
  objections: [],
  discoveryQuestions: [],
  winStoryHint: "",
  sources: [],
};

function fakeAnthropic(responses: string[], stopReason: string = "end_turn"): Anthropic {
  let call = 0;
  return {
    messages: {
      stream: () => ({
        finalMessage: async () => ({
          stop_reason: stopReason,
          content: [{ type: "text", text: responses[Math.min(call++, responses.length - 1)] }],
        }),
      }),
    },
  } as unknown as Anthropic;
}

test("briefCacheKey is stable and identifies the prospect", () => {
  const a = briefCacheKey(profile, prospect, "ws1");
  const b = briefCacheKey(profile, prospect, "ws1");
  assert.equal(a, b);
  assert.match(a, /Richards Building Supply/);
});

test("requestBriefWithRetry recovers when the first response has an unescaped quote", async () => {
  // Reproduces "Expected ',' or '}' after property value" — a verbatim quote
  // embedded in a string value without escaping.
  const malformed = `{"company": "Richards Building Supply", "summary": "They said "we need this" on the call"}`;
  const anthropic = fakeAnthropic([malformed, JSON.stringify(validBrief)]);

  const brief = await requestBriefWithRetry(anthropic, "irrelevant prompt");
  assert.equal(brief.company, "Richards Building Supply");
});

test("requestBriefWithRetry gives up after two malformed responses in a row", async () => {
  const malformed = `{"company": "Richards Building Supply", "summary": "bad "quote" here"}`;
  const anthropic = fakeAnthropic([malformed, malformed]);

  await assert.rejects(
    () => requestBriefWithRetry(anthropic, "irrelevant prompt"),
    JsonFormatError
  );
});

test("a response truncated at max_tokens is reported as JsonFormatError, not a raw SyntaxError", async () => {
  const truncated = `{"company": "Richards Building Supply", "summary": "cut off mid senten`;
  const anthropic = fakeAnthropic([truncated, truncated], "max_tokens");

  await assert.rejects(
    () => requestBriefWithRetry(anthropic, "irrelevant prompt"),
    JsonFormatError
  );
});

test("requestBriefWithRetry succeeds immediately on well-formed JSON (no retry needed)", async () => {
  const anthropic = fakeAnthropic([JSON.stringify(validBrief)]);
  const brief = await requestBriefWithRetry(anthropic, "irrelevant prompt");
  assert.equal(brief.company, "Richards Building Supply");
  assert.equal(brief.fitScore, 62);
});
