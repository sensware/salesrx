import { NextRequest, NextResponse } from "next/server";
import { client, MODEL, extractJson, textOf } from "@/lib/anthropic";
import { meetingNotesSystemPrompt } from "@/lib/prompts";
import { getCtx, unauthorized } from "@/lib/auth";
import {
  getOrCreateAccount, updateAccount, loadAccounts, type MeetingRecord,
} from "@/lib/accounts";

export const maxDuration = 120;

/** Log meeting notes: extracts outcomes/next steps, drafts the follow-up
 *  email, and updates the workspace-shared account memory. */
export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return unauthorized();

  let body: { name: string; domain?: string; notes: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.name || !body?.notes?.trim()) {
    return NextResponse.json({ error: "name and notes are required" }, { status: 400 });
  }

  const account = await getOrCreateAccount(body.name, body.domain, ctx.workspaceId);

  try {
    const { consume } = await import("@/lib/usage");
    await consume(ctx, "meetings");
    const anthropic = client();
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: meetingNotesSystemPrompt(),
      messages: [
        {
          role: "user",
          content: `Prospect: ${account.name}
Previous account summary: ${account.memorySummary || "none (first logged meeting)"}

RAW MEETING NOTES:
${body.notes}`,
        },
      ],
    });

    const extracted = extractJson<{
      outcomes: string[];
      nextSteps: string[];
      objectionsHeard: string[];
      followUpEmail: string;
      memoryUpdate: string;
    }>(textOf(msg));

    const record: MeetingRecord = {
      date: new Date().toISOString(),
      rawNotes: body.notes,
      outcomes: extracted.outcomes || [],
      nextSteps: extracted.nextSteps || [],
      objectionsHeard: extracted.objectionsHeard || [],
      followUpEmail: extracted.followUpEmail || "",
      loggedBy: ctx.email,
    };
    account.meetings.push(record);
    account.memorySummary = extracted.memoryUpdate || account.memorySummary;
    await updateAccount(account, ctx.workspaceId);

    return NextResponse.json({ meeting: record, memorySummary: account.memorySummary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Meeting analysis failed";
    const status = (err as { status?: number })?.status === 429 ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** List the workspace's accounts with memory. */
export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return unauthorized();
  return NextResponse.json({ accounts: await loadAccounts(ctx.workspaceId) });
}
