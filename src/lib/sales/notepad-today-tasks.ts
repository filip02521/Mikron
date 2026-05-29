import type { SalesNote, SalesPaymentWatch } from "@/types/database";
import { isFollowUpDue, formatFollowUpLabel } from "@/lib/sales/notepad-follow-up";
import { isPaymentWatchOverdue } from "@/lib/sales/payment-watch-sort";
import { formatPln } from "@/lib/sales/notepad-format";

export type NotepadTodayTaskKind =
  | "zk-overdue"
  | "zk-follow-up"
  | "note-follow-up";

export type NotepadTodayTask = {
  kind: NotepadTodayTaskKind;
  id: string;
  anchor: string;
  title: string;
  subtitle?: string | null;
  priority: number;
};

function taskPriority(kind: NotepadTodayTaskKind): number {
  switch (kind) {
    case "zk-overdue":
      return 0;
    case "zk-follow-up":
      return 1;
    case "note-follow-up":
      return 2;
  }
}

export function collectNotepadTodayTasks(
  watches: SalesPaymentWatch[],
  notes: SalesNote[]
): NotepadTodayTask[] {
  const tasks: NotepadTodayTask[] = [];

  for (const watch of watches) {
    if (watch.settled_at || watch.archived_at) continue;
    if (isPaymentWatchOverdue(watch)) {
      tasks.push({
        kind: "zk-overdue",
        id: watch.id,
        anchor: `watch-${watch.id}`,
        title: watch.zk_number,
        subtitle: `${watch.client_label} · ${formatPln(watch.amount_gross)} · po terminie płatności`,
        priority: taskPriority("zk-overdue"),
      });
      continue;
    }
    if (isFollowUpDue(watch.follow_up_at)) {
      tasks.push({
        kind: "zk-follow-up",
        id: watch.id,
        anchor: `watch-${watch.id}`,
        title: watch.zk_number,
        subtitle: `${watch.client_label} · przypomnienie ${formatFollowUpLabel(watch.follow_up_at) ?? ""}`.trim(),
        priority: taskPriority("zk-follow-up"),
      });
    }
  }

  for (const note of notes) {
    if (note.archived_at) continue;
    if (!isFollowUpDue(note.follow_up_at)) continue;
    const title = note.title?.trim() || note.body.trim().slice(0, 48) || "Notatka";
    tasks.push({
      kind: "note-follow-up",
      id: note.id,
      anchor: `note-${note.id}`,
      title,
      subtitle: `Przypomnienie ${formatFollowUpLabel(note.follow_up_at) ?? ""}`.trim(),
      priority: taskPriority("note-follow-up"),
    });
  }

  return tasks.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title, "pl"));
}

export function hasNotepadTodayTasks(
  watches: SalesPaymentWatch[],
  notes: SalesNote[]
): boolean {
  return collectNotepadTodayTasks(watches, notes).length > 0;
}
