import type { SalesBoardAttentionSnapshot } from "@/lib/data/department-board";
import {
  inboxFilterLabel,
  rowNeedsSalesAction,
  type MyOrderInboxFilter,
} from "@/lib/orders/my-order-inbox-filter";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  summarizeMyOrdersInbox,
  enrichMyOrderSalesUi,
  type MyOrdersInboxSummary,
} from "@/lib/orders/my-order-sales-ui";
import { myOrderPickupAckLabel } from "@/lib/orders/my-order-pickup-ack-copy";
import { formatFollowUpLabel } from "@/lib/sales/notepad-follow-up";
import { sortSalesNotes } from "@/lib/sales/notepad-note-sort";
import { collectNotepadTodayTasks } from "@/lib/sales/notepad-today-tasks";
import type { SalesNote, SalesZkWatch } from "@/types/database";

export type SalesDayStartSource =
  | "pickup"
  | "cancel_ack"
  | "informacja_ready"
  | "zk_follow_up"
  | "note_follow_up"
  | "board_answer"
  | "board_announcement";

export type SalesDayStartItem = {
  id: string;
  source: SalesDayStartSource;
  priority: number;
  title: string;
  subtitle?: string;
  evidence?: string;
  href: string;
  /** Filtr inboxu /moje — klik ustawia filtr zamiast nawigacji. */
  inboxFilter?: MyOrderInboxFilter;
  scrollTarget?: string;
  count?: number;
  ctaLabel: string;
};

export type SalesDayStartBreakdown = {
  orders: number;
  notepad: number;
  board: number;
};

export type SalesDayStartSnapshot = {
  items: SalesDayStartItem[];
  totalActionCount: number;
  pinnedNotes: SalesNote[];
  pinnedNoteOverflow: number;
  cleared: boolean;
  breakdown: SalesDayStartBreakdown;
  inboxSummary: MyOrdersInboxSummary;
};

const PRIORITY: Record<SalesDayStartSource, number> = {
  pickup: 10,
  cancel_ack: 20,
  informacja_ready: 30,
  zk_follow_up: 40,
  note_follow_up: 50,
  board_answer: 60,
  board_announcement: 70,
};

const PINNED_NOTES_LIMIT = 4;
const MOJE_ACTION_SECTION = "moje-section-action";

function groupPickupBySupplier(
  rows: MyOrderRow[]
): { supplierName: string; lineCount: number }[] {
  const bySupplier = new Map<string, number>();
  for (const row of rows) {
    if (row.acknowledgeMode !== "pickup" || row.pickupPendingIds.length === 0) continue;
    const name = row.supplierName?.trim() || "Do ustalenia";
    bySupplier.set(name, (bySupplier.get(name) ?? 0) + row.pickupPendingIds.length);
  }
  return [...bySupplier.entries()]
    .map(([supplierName, lineCount]) => ({ supplierName, lineCount }))
    .sort((a, b) => b.lineCount - a.lineCount || a.supplierName.localeCompare(b.supplierName, "pl"));
}

function buildOrderActionItems(rows: MyOrderRow[]): SalesDayStartItem[] {
  const items: SalesDayStartItem[] = [];
  const actionRows = rows.filter(rowNeedsSalesAction);

  for (const group of groupPickupBySupplier(actionRows)) {
    items.push({
      id: `pickup-${group.supplierName}`,
      source: "pickup",
      priority: PRIORITY.pickup,
      title: myOrderPickupAckLabel(group.lineCount),
      subtitle: group.supplierName,
      evidence: `${group.lineCount} ${group.lineCount === 1 ? "pozycja" : group.lineCount < 5 ? "pozycje" : "pozycji"} u ${group.supplierName}`,
      href: `/moje#${MOJE_ACTION_SECTION}`,
      inboxFilter: "pickup",
      scrollTarget: MOJE_ACTION_SECTION,
      count: group.lineCount,
      ctaLabel: "Przejdź",
    });
  }

  const cancelRows = actionRows.filter(
    (r) => enrichMyOrderSalesUi(r).sortPriority === 3
  );
  if (cancelRows.length > 0) {
    const n = cancelRows.length;
    items.push({
      id: "cancel-ack",
      source: "cancel_ack",
      priority: PRIORITY.cancel_ack,
      title: n === 1 ? "Potwierdź anulowanie" : `Potwierdź anulowania (${n})`,
      subtitle: "Ukryj z listy po potwierdzeniu",
      href: `/moje#${MOJE_ACTION_SECTION}`,
      inboxFilter: "cancel_ack",
      scrollTarget: MOJE_ACTION_SECTION,
      count: n,
      ctaLabel: "Przejdź",
    });
  }

  const informacjaRows = actionRows.filter(
    (r) => enrichMyOrderSalesUi(r).sortPriority === 10
  );
  if (informacjaRows.length > 0) {
    const n = informacjaRows.length;
    items.push({
      id: "informacja-ready",
      source: "informacja_ready",
      priority: PRIORITY.informacja_ready,
      title: n === 1 ? "Potwierdź informację o dostępności" : `Potwierdź informacje (${n})`,
      subtitle: "Towar na magazynie — do potwierdzenia",
      href: `/moje#${MOJE_ACTION_SECTION}`,
      inboxFilter: "informacja_ready",
      scrollTarget: MOJE_ACTION_SECTION,
      count: n,
      ctaLabel: "Przejdź",
    });
  }

  return items;
}

function buildNotepadItems(
  watches: SalesZkWatch[],
  notes: SalesNote[],
  previewDla?: string | null
): SalesDayStartItem[] {
  const previewQs = previewDla ? `?dla=${encodeURIComponent(previewDla)}` : "";
  const tasks = collectNotepadTodayTasks(watches, notes);

  return tasks.map((task) => {
    const isZk = task.kind === "zk-follow-up";
    return {
      id: `${task.kind}-${task.id}`,
      source: isZk ? "zk_follow_up" : "note_follow_up",
      priority: isZk ? PRIORITY.zk_follow_up : PRIORITY.note_follow_up,
      title: isZk ? `Przypomnienie ZK ${task.title}` : task.title,
      subtitle: task.subtitle ?? undefined,
      evidence: task.subtitle ?? undefined,
      href: isZk
        ? `/notatnik${previewQs}#${task.anchor}`
        : `/notatnik${previewQs}#${task.anchor}`,
      count: 1,
      ctaLabel: "Notatnik",
    };
  });
}

function buildBoardItems(
  board: SalesBoardAttentionSnapshot,
  previewDla?: string | null
): SalesDayStartItem[] {
  const items: SalesDayStartItem[] = [];
  const previewQs = previewDla ? `?dla=${encodeURIComponent(previewDla)}` : "";

  if (board.unseenAnswerCount > 0) {
    const preview = board.unseenAnswerPreview;
    const href =
      board.unseenAnswerCount === 1 && preview
        ? `/tablica${previewQs}${previewQs ? "&" : "?"}widok=pytania&watek=${preview.threadId}`
        : `/tablica${previewQs}${previewQs ? "&" : "?"}widok=pytania`;

    items.push({
      id: "board-answers",
      source: "board_answer",
      priority: PRIORITY.board_answer,
      title: preview?.isOwnQuestion
        ? board.unseenAnswerCount === 1
          ? "Zakupy odpowiedziały na Twoje pytanie"
          : `Zakupy odpowiedziały (${board.unseenAnswerCount})`
        : board.unseenAnswerCount === 1
          ? "Nowa odpowiedź zakupów"
          : `${board.unseenAnswerCount} nowe odpowiedzi zakupów`,
      subtitle: preview?.title ? `„${preview.title}”` : undefined,
      href,
      count: board.unseenAnswerCount,
      ctaLabel: "Tablica",
    });
  }

  if (board.unreadAnnouncementBannerCount > 0) {
    items.push({
      id: "board-announcements",
      source: "board_announcement",
      priority: PRIORITY.board_announcement,
      title:
        board.unreadAnnouncementBannerCount === 1
          ? "Nowe ogłoszenie od zakupów"
          : `${board.unreadAnnouncementBannerCount} nowe ogłoszenia`,
      subtitle: board.unreadAnnouncementBannerLatestTitle ?? undefined,
      href: `/tablica${previewQs}${previewQs ? "&" : "?"}widok=ogloszenia`,
      count: board.unreadAnnouncementBannerCount,
      ctaLabel: "Przeczytaj",
    });
  }

  return items;
}

export function buildSalesDayStartSnapshot(input: {
  rows: MyOrderRow[];
  watches?: SalesZkWatch[];
  notes?: SalesNote[];
  boardAttention?: SalesBoardAttentionSnapshot | null;
  previewDla?: string | null;
}): SalesDayStartSnapshot {
  const { rows, watches = [], notes = [], boardAttention, previewDla } = input;
  const inboxSummary = summarizeMyOrdersInbox(rows);

  const orderItems = buildOrderActionItems(rows);
  const notepadItems = buildNotepadItems(watches, notes, previewDla);
  const boardItems = boardAttention ? buildBoardItems(boardAttention, previewDla) : [];

  const items = [...orderItems, ...notepadItems, ...boardItems].sort(
    (a, b) => a.priority - b.priority || (b.count ?? 0) - (a.count ?? 0)
  );

  const breakdown: SalesDayStartBreakdown = {
    orders:
      inboxSummary.pickupCount +
      inboxSummary.cancelAckCount +
      inboxSummary.informacjaReadyCount,
    notepad: notepadItems.length,
    board: boardItems.reduce((sum, i) => sum + (i.count ?? 1), 0),
  };

  const totalActionCount = breakdown.orders + breakdown.notepad + breakdown.board;

  const sortedPinned = sortSalesNotes(notes.filter((n) => n.pinned && !n.archived_at));
  const pinnedNotes = sortedPinned.slice(0, PINNED_NOTES_LIMIT);
  const pinnedNoteOverflow = Math.max(0, sortedPinned.length - PINNED_NOTES_LIMIT);

  return {
    items,
    totalActionCount,
    pinnedNotes,
    pinnedNoteOverflow,
    cleared: totalActionCount === 0,
    breakdown,
    inboxSummary,
  };
}

/** Etykiety breakdown chipów w panelu Start dnia. */
export function salesDayStartBreakdownLabels(
  breakdown: SalesDayStartBreakdown
): { key: keyof SalesDayStartBreakdown; label: string; count: number }[] {
  const out: { key: keyof SalesDayStartBreakdown; label: string; count: number }[] = [];
  if (breakdown.orders > 0) {
    out.push({ key: "orders", label: "Zamówienia", count: breakdown.orders });
  }
  if (breakdown.notepad > 0) {
    out.push({ key: "notepad", label: "Notatnik", count: breakdown.notepad });
  }
  if (breakdown.board > 0) {
    out.push({ key: "board", label: "Tablica", count: breakdown.board });
  }
  return out;
}

export function salesDayStartSourceLabel(source: SalesDayStartSource): string {
  switch (source) {
    case "pickup":
      return inboxFilterLabel("pickup");
    case "cancel_ack":
      return inboxFilterLabel("cancel_ack");
    case "informacja_ready":
      return inboxFilterLabel("informacja_ready");
    case "zk_follow_up":
      return "ZK";
    case "note_follow_up":
      return "Notatka";
    case "board_answer":
      return "Odpowiedź";
    case "board_announcement":
      return "Ogłoszenie";
  }
}

export function salesDayStartNavCount(
  inboxSummary: MyOrdersInboxSummary,
  notepadDueCount: number,
  boardNavCount: number
): number {
  return (
    inboxSummary.pickupCount +
    inboxSummary.cancelAckCount +
    inboxSummary.informacjaReadyCount +
    notepadDueCount +
    boardNavCount
  );
}

/** Krótki opis follow-upu do kart przypiętych (gdy mają termin). */
export function pinnedNoteFollowUpHint(note: SalesNote): string | null {
  if (!note.follow_up_at) return null;
  const label = formatFollowUpLabel(note.follow_up_at);
  return label ? `Przypomnienie ${label}` : null;
}
