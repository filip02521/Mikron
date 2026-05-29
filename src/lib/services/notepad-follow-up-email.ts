import { createAdminClient } from "@/lib/supabase/admin";
import { sendHtmlEmail, type EmailSendResult } from "@/lib/services/email";
import { renderNotepadFollowUpEmail } from "@/lib/email/notepad-follow-up-email";
import { collectNotepadTodayTasks } from "@/lib/sales/notepad-today-tasks";
import type { SalesNote, SalesPaymentWatch } from "@/types/database";
import { warsawNowParts } from "@/lib/time/warsaw";

export type NotepadFollowUpEmailRunResult = EmailSendResult & {
  recipients: number;
  itemsNotified: number;
};

function needsDigestToday(
  item: { digest_notified_at: string | null },
  todayKey: string
): boolean {
  return item.digest_notified_at?.slice(0, 10) !== todayKey;
}

export async function runNotepadFollowUpEmails(
  todayKey = warsawNowParts().dateKey
): Promise<NotepadFollowUpEmailRunResult> {
  const supabase = createAdminClient();
  const result: NotepadFollowUpEmailRunResult = {
    sent: 0,
    failures: [],
    recipients: 0,
    itemsNotified: 0,
  };

  const { data: people, error: peopleError } = await supabase
    .from("sales_people")
    .select("id, name, email");
  if (peopleError) throw new Error(peopleError.message);

  for (const person of people ?? []) {
    const email = person.email?.trim();
    if (!email) continue;

    const [watchesRes, notesRes] = await Promise.all([
      supabase
        .from("sales_payment_watches")
        .select("*")
        .eq("sales_person_id", person.id)
        .is("settled_at", null)
        .is("archived_at", null),
      supabase
        .from("sales_notes")
        .select("*")
        .eq("sales_person_id", person.id)
        .is("archived_at", null),
    ]);

    if (watchesRes.error) throw new Error(watchesRes.error.message);
    if (notesRes.error) throw new Error(notesRes.error.message);

    const watches = (watchesRes.data ?? []) as SalesPaymentWatch[];
    const notes = (notesRes.data ?? []) as SalesNote[];
    const allTasks = collectNotepadTodayTasks(watches, notes);

    const pendingWatchIds = new Set<string>();
    const pendingNoteIds = new Set<string>();

    for (const task of allTasks) {
      if (task.kind === "note-follow-up") {
        const row = notes.find((n) => n.id === task.id);
        if (row && needsDigestToday(row, todayKey)) pendingNoteIds.add(task.id);
      } else {
        const row = watches.find((w) => w.id === task.id);
        if (row && needsDigestToday(row, todayKey)) pendingWatchIds.add(task.id);
      }
    }

    const tasks = allTasks.filter((task) =>
      task.kind === "note-follow-up"
        ? pendingNoteIds.has(task.id)
        : pendingWatchIds.has(task.id)
    );

    if (!tasks.length) continue;

    result.recipients += 1;
    const { subject, html } = renderNotepadFollowUpEmail({
      recipientName: person.name,
      tasks,
    });

    const send = await sendHtmlEmail({ to: email, subject, html });
    if (!send.ok) {
      result.failures.push({ to: send.to, error: send.error });
      continue;
    }

    result.sent += 1;
    result.itemsNotified += tasks.length;

    const now = new Date().toISOString();
    if (pendingWatchIds.size) {
      await supabase
        .from("sales_payment_watches")
        .update({ digest_notified_at: todayKey, updated_at: now })
        .in("id", [...pendingWatchIds]);
    }
    if (pendingNoteIds.size) {
      await supabase
        .from("sales_notes")
        .update({ digest_notified_at: todayKey, updated_at: now })
        .in("id", [...pendingNoteIds]);
    }
  }

  return result;
}

export async function notepadFollowUpAlreadyRanToday(): Promise<boolean> {
  const { dateKey } = warsawNowParts();
  const { readCronRun } = await import("@/lib/services/cron-run-log");
  const last = await readCronRun("notepad_follow_up");
  if (!last?.ok) return false;
  const detail = last.detail as { warsawDateKey?: string; skipped?: boolean } | undefined;
  if (detail?.skipped) return false;
  return detail?.warsawDateKey === dateKey;
}
