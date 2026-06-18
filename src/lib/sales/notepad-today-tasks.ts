import type { SalesNote, SalesZkWatch } from "@/types/database";
import { isFollowUpDue, formatFollowUpLabel } from "@/lib/sales/notepad-follow-up";
import { countRegalWaitingZkLines } from "@/lib/sales/zk-watch-warehouse-notify";

export type NotepadTodayTaskKind =
  | "zk-follow-up"
  | "zk-warehouse-arrival"
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
    case "zk-warehouse-arrival":
      return -1;
    case "zk-follow-up":
      return 0;
    case "note-follow-up":
      return 1;
  }
}

export function collectNotepadTodayTasks(
  watches: SalesZkWatch[],
  notes: SalesNote[],
  options?: {
    unseenWarehouseWatchIds?: Set<string> | string[];
    inStockCountByWatchId?: Record<string, number | string[]>;
  }
): NotepadTodayTask[] {
  const tasks: NotepadTodayTask[] = [];
  const unseenWarehouse = new Set(options?.unseenWarehouseWatchIds ?? []);

  function inStockCountForWatch(watchId: string): number {
    const raw = options?.inStockCountByWatchId?.[watchId];
    if (Array.isArray(raw)) return countRegalWaitingZkLines(raw);
    if (typeof raw === "number") return raw;
    return 0;
  }

  for (const watch of watches) {
    if (watch.closed_at || watch.archived_at) continue;
    if (unseenWarehouse.has(watch.id)) {
      const inStock = inStockCountForWatch(watch.id);
      tasks.push({
        kind: "zk-warehouse-arrival",
        id: watch.id,
        anchor: `watch-${watch.id}`,
        title: watch.zk_number,
        subtitle: `${watch.client_label} · ${inStock} ${inStock === 1 ? "pozycja" : inStock < 5 ? "pozycje" : "pozycji"} na regale`,
        priority: taskPriority("zk-warehouse-arrival"),
      });
    }
  }

  for (const watch of watches) {
    if (watch.closed_at || watch.archived_at) continue;
    if (!isFollowUpDue(watch.follow_up_at)) continue;
    tasks.push({
      kind: "zk-follow-up",
      id: watch.id,
      anchor: `watch-${watch.id}`,
      title: watch.zk_number,
      subtitle: `${watch.client_label} · przypomnienie ${formatFollowUpLabel(watch.follow_up_at) ?? ""}`.trim(),
      priority: taskPriority("zk-follow-up"),
    });
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
  watches: SalesZkWatch[],
  notes: SalesNote[],
  options?: {
    unseenWarehouseWatchIds?: Set<string> | string[];
    inStockCountByWatchId?: Record<string, number | string[]>;
  }
): boolean {
  return collectNotepadTodayTasks(watches, notes, options).length > 0;
}
