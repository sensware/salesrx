/**
 * v2.1 — primary-sources collector: SEC filings, press coverage, earnings-call
 * transcripts. Free by default (EDGAR + Google News RSS), transcripts key-gated.
 * Output is a prompt block the research agent treats as citable ground truth.
 */
import { edgarFilings, tickerFrom } from "./edgar";
import { pressItems } from "./newsfeed";
import { latestTranscriptExcerpt } from "./transcripts";
import type { ProspectInput, RepProfile } from "./types";

export async function primarySourcesBlock(
  prospect: ProspectInput,
  profile: RepProfile
): Promise<string | undefined> {
  const name = prospect.name?.trim();
  if (!name) return undefined;

  const [filings, press] = await Promise.all([
    edgarFilings(name),
    pressItems(name),
  ]);

  const ticker = tickerFrom(filings);
  const keywords = [
    ...(profile?.vertical || "").split(/[\s,/]+/),
    ...(profile?.productType || "").split(/[\s,/]+/),
    "challenge", "headwind", "cost", "invest", "margin",
  ];
  const transcript = ticker ? await latestTranscriptExcerpt(ticker, keywords) : null;

  const parts: string[] = [];
  if (filings.length) {
    parts.push(
      "Recent SEC filings (official record — 8-K exhibits often contain the earnings press release):\n" +
        filings.map((f) => `- ${f.form} · ${f.date} · ${f.url}`).join("\n")
    );
  }
  if (press.length) {
    parts.push(
      "Recent press coverage (items marked [PR] are wire press releases — company's own words):\n" +
        press
          .map((p) => `- ${p.isPressRelease ? "[PR] " : ""}${p.date} · ${p.title} (${p.source}) · ${p.url}`)
          .join("\n")
    );
  }
  if (transcript) {
    parts.push(
      `Earnings-call transcript excerpts (${transcript.ticker}, ${transcript.quarter}) — executives' own words; ideal evidence for pain points and NEPQ consequence questions. Cite as "Q earnings call":\n"""${transcript.excerpt}"""`
    );
  }

  if (!parts.length) return undefined;
  return `PRIMARY SOURCES (verified feeds — prefer these over general web search for claims; cite the URLs given):\n\n${parts.join("\n\n")}`;
}
