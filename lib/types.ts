export interface RepProfile {
  industry: string;
  vertical: string;
  productType: string;
  location: string;
  competitors: string; // comma-separated
  moat: string;
}

export interface ProspectInput {
  name: string;
  domain?: string;
  location?: string;
  contact?: string;
}

export interface Signal {
  when: string; // e.g. "2 weeks ago"
  headline: string;
  detail: string;
  kind: "opportunity" | "warning" | "info";
  sourceUrl?: string;
}

export interface NepqStep {
  stage: "Situation" | "Problem awareness" | "Consequence" | "Solution awareness" | "Commitment";
  question: string;
}

export interface PainPoint {
  pain: string;
  evidence: string; // which signal/source this is derived from
  confidence: "high" | "medium" | "low";
  ladder: NepqStep[];
}

export interface Person {
  name: string;
  title: string;
  role: "economic_buyer" | "champion" | "blocker" | "influencer";
  note: string;
}

export interface Objection {
  objection: string;
  response: string;
}

export interface Brief {
  company: string;
  meta: string; // domain · HQ · industry · size · revenue
  tags: string[];
  fitScore: number; // 0-100
  fitBreakdown: { label: string; score: number; max: number }[];
  summary: string;
  signals: Signal[];
  stack: string[];
  incumbent: string;
  stackNote: string;
  challenges: string[];
  painPoints: PainPoint[];
  people: Person[];
  rapport: { icon: string; label: string; detail: string }[];
  objections: Objection[];
  discoveryQuestions: string[];
  winStoryHint: string;
  sources: { title: string; url: string }[];
}

export interface CoachingTip {
  icon: string;
  tip: string;
}
