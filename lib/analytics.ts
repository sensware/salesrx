/**
 * v2.5 — outcome analytics: the loop from brief → meeting → next step → stage.
 * Computed from workspace account memory; also the design-partner case-study
 * engine ("briefed meetings converted X% better").
 */
import { loadAccounts, type DealStage } from "./accounts";

export interface WorkspaceAnalytics {
  accountsResearched: number;
  briefsRun: number;
  meetingsLogged: number;
  accountsWithMeetings: number;
  briefToMeetingRate: number; // accounts with ≥1 meeting / accounts with ≥1 brief
  nextStepRate: number; // meetings with nextStepBooked / meetings with outcome data
  stages: Record<DealStage, number>; // latest stage per account
  topObjections: { objection: string; count: number }[];
  perRep: { rep: string; meetings: number; nextStepRate: number }[];
}

export async function computeAnalytics(workspaceId: string): Promise<WorkspaceAnalytics> {
  const accounts = await loadAccounts(workspaceId);

  const stages: Record<DealStage, number> = {
    discovery: 0, proposal: 0, negotiation: 0,
    "closed-won": 0, "closed-lost": 0, "no-next-step": 0,
  };
  const objectionCounts = new Map<string, number>();
  const repStats = new Map<string, { meetings: number; booked: number; withOutcome: number }>();

  let meetingsLogged = 0;
  let withOutcome = 0;
  let booked = 0;
  let accountsWithMeetings = 0;
  let briefsRun = 0;
  let accountsWithBriefs = 0;

  for (const acc of accounts) {
    briefsRun += acc.briefsRun;
    if (acc.briefsRun > 0) accountsWithBriefs++;
    if (acc.meetings.length > 0) accountsWithMeetings++;

    // latest known stage per account
    const lastStage = [...acc.meetings].reverse().find((m) => m.stage)?.stage;
    if (lastStage) stages[lastStage]++;

    for (const m of acc.meetings) {
      meetingsLogged++;
      if (m.nextStepBooked !== undefined) {
        withOutcome++;
        if (m.nextStepBooked) booked++;
      }
      for (const o of m.objectionsHeard || []) {
        const key = o.toLowerCase().slice(0, 60);
        objectionCounts.set(key, (objectionCounts.get(key) || 0) + 1);
      }
      const rep = m.loggedBy || "you";
      const r = repStats.get(rep) || { meetings: 0, booked: 0, withOutcome: 0 };
      r.meetings++;
      if (m.nextStepBooked !== undefined) {
        r.withOutcome++;
        if (m.nextStepBooked) r.booked++;
      }
      repStats.set(rep, r);
    }
  }

  return {
    accountsResearched: accounts.length,
    briefsRun,
    meetingsLogged,
    accountsWithMeetings,
    briefToMeetingRate: accountsWithBriefs ? accountsWithMeetings / accountsWithBriefs : 0,
    nextStepRate: withOutcome ? booked / withOutcome : 0,
    stages,
    topObjections: [...objectionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([objection, count]) => ({ objection, count })),
    perRep: [...repStats.entries()]
      .map(([rep, r]) => ({
        rep,
        meetings: r.meetings,
        nextStepRate: r.withOutcome ? r.booked / r.withOutcome : 0,
      }))
      .sort((a, b) => b.meetings - a.meetings),
  };
}
