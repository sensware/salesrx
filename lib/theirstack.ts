/**
 * TheirStack integration — job-post-based hiring signals + technographics.
 * Optional: activates when THEIRSTACK_API_KEY is set; otherwise the research
 * agent falls back to LLM web search for these signals.
 * Docs: https://theirstack.com/en/docs/api-reference
 */
import type { ProspectInput } from "./types";

const BASE = "https://api.theirstack.com/v1";

export interface StructuredSignals {
  jobs: {
    title: string;
    datePosted: string;
    location: string;
    seniority?: string;
    technologies: string[];
    url?: string;
  }[];
  technologies: {
    name: string;
    category: string;
    confidence: string;
    jobs: number;
    lastSeen: string;
  }[];
}

function companyFilter(prospect: ProspectInput): Record<string, unknown> {
  if (prospect.domain) return { company_domain_or: [prospect.domain] };
  return { company_name_case_insensitive_or: [prospect.name] };
}

async function post<T>(path: string, body: unknown, key: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.warn(`TheirStack ${path} -> ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`TheirStack ${path} failed:`, e);
    return null;
  }
}

export async function getStructuredSignals(
  prospect: ProspectInput
): Promise<StructuredSignals | null> {
  const key = process.env.THEIRSTACK_API_KEY;
  if (!key) return null;

  interface JobsResp {
    data: {
      job_title: string;
      date_posted: string;
      short_location?: string;
      location?: string;
      seniority?: string;
      technology_slugs?: string[];
      url?: string;
    }[];
  }
  interface TechResp {
    data: {
      technology: { name: string; category: string };
      confidence: string;
      jobs: number;
      last_date_found: string;
    }[];
  }

  const [jobsResp, techResp] = await Promise.all([
    post<JobsResp>(
      "/jobs/search",
      { ...companyFilter(prospect), posted_at_max_age_days: 90, limit: 10 },
      key
    ),
    post<TechResp>(
      "/companies/technologies",
      prospect.domain
        ? { company_domain: prospect.domain, limit: 25, confidence_or: ["high", "medium"] }
        : { company_name: prospect.name, limit: 25, confidence_or: ["high", "medium"] },
      key
    ),
  ]);

  if (!jobsResp && !techResp) return null;

  return {
    jobs: (jobsResp?.data || []).map((j) => ({
      title: j.job_title,
      datePosted: j.date_posted,
      location: j.short_location || j.location || "",
      seniority: j.seniority,
      technologies: j.technology_slugs || [],
      url: j.url,
    })),
    technologies: (techResp?.data || []).map((t) => ({
      name: t.technology.name,
      category: t.technology.category,
      confidence: t.confidence,
      jobs: t.jobs,
      lastSeen: t.last_date_found,
    })),
  };
}

/** Render structured signals as a prompt block the research agent treats as ground truth. */
export function signalsToPromptBlock(s: StructuredSignals): string {
  const jobs = s.jobs
    .map(
      (j) =>
        `- "${j.title}" (${j.datePosted}${j.location ? ", " + j.location : ""}${
          j.seniority ? ", " + j.seniority : ""
        })${j.technologies.length ? " — mentions: " + j.technologies.join(", ") : ""}`
    )
    .join("\n");
  const tech = s.technologies
    .map((t) => `- ${t.name} (${t.category}) — confidence ${t.confidence}, ${t.jobs} job mentions, last seen ${t.lastSeen}`)
    .join("\n");
  return `VERIFIED STRUCTURED DATA (from job-posting analysis — treat as ground truth, cite as "job-posting data"):

Open roles (last 90 days):
${jobs || "- none found"}

Detected technology stack:
${tech || "- none found"}`;
}
