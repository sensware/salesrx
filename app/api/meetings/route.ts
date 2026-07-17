import { NextRequest, NextResponse } from "next/server";
import { client, MODEL, extractJson, textOf } from "@/lib/anthropic";
import { meetingNotesSystemPrompt } from "@/lib/prompts";
import { getOrCreateAccount, updateAccount, type MeetingRecord } from "@/lib/accounts";

export const maxDuration = 120;

/** Log meeting notes for an account: extracts outcomes/next steps, drafts the
 *  follow-up email, and updates the rolling account memory. */
export async function POST(req: NextRequest) {
  let body: { name: string; domain?: string; notes: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.name || !body?.notes?.trim()) {
    return NextResponse.json({ error: "name and notes are required" }, { status: 400 });
  }

  const account = getOrCreateAccount(body.name, body.domain);

  try {
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
    };
    account.meetings.push(record);
    account.memorySummary = extracted.memoryUpdate || account.memorySummary;
    updateAccount(account);

    return NextResponse.json({ meeting: record, memorySummary: account.memorySummary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Meeting analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** List accounts with memory (for a future accounts view). */
export async function GET() {
  const { loadAccounts } = await import("@/lib/accounts");
  return NextResponse.json({ accounts: loadAccounts() });
}
