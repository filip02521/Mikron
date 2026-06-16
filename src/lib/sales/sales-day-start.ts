import type { SalesBoardAttentionSnapshot } from "@/lib/data/department-board";
import {
  rowNeedsSalesAction,
} from "@/lib/orders/my-order-inbox-filter";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  summarizeMyOrdersInbox,
  enrichMyOrderSalesUi,
  type MyOrdersInboxSummary,
} from "@/lib/orders/my-order-sales-ui";
import { collectNotepadTodayTasks } from "@/lib/sales/notepad-today-tasks";
import { formatProsbaZkLinkNumber } from "@/lib/orders/zk-prosba-link-display";
import { buildNotatnikPageHref } from "@/lib/sales/notepad-page-tabs";
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
  /** Sekcja listy /moje — klik przewija i podświetla zamiast nawigacji. */
  scrollTarget?: string;
  count?: number;
  ctaLabel: string;
};

export type SalesDayStartSnapshot = {
  items: SalesDayStartItem[];
  totalActionCount: number;
  cleared: boolean;
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

const MOJE_ACTION_SECTION = "moje-section-action";

/** Od tej liczby pozycji odbioru — jedno powiadomienie zbiorcze (jak informacje). */
const PICKUP_AGGREGATE_FROM = 2;

/** Maks. zadań w panelu przed „Pokaż wszystkie”. */
export const SALES_DAY_START_VISIBLE_LIMIT = 6;

/** Dane spoza listy zamówień — notatnik i tablica z RSC. */
export type SalesDayStartContext = {
  watches: SalesZkWatch[];
  notes: SalesNote[];
  boardAttention?: SalesBoardAttentionSnapshot | null;
  previewDla?: string | null;
};

function countPickupLines(rows: MyOrderRow[]): number {
  let total = 0;
  for (const row of rows) {
    if (row.acknowledgeMode !== "pickup" || row.pickupPendingIds.length === 0) continue;
    total += row.pickupPendingIds.length;
  }
  return total;
}

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

  const pickupGroups = groupPickupBySupplier(actionRows);
  const pickupLineCount = countPickupLines(actionRows);

  if (pickupLineCount >= PICKUP_AGGREGATE_FROM) {
    items.push({
      id: "pickup-ready",
      source: "pickup",
      priority: PRIORITY.pickup,
      title: `Potwierdź odbiór (${pickupLineCount})`,
      subtitle: "Produkty gotowe na magazynie — do potwierdzenia",
      href: `/moje#${MOJE_ACTION_SECTION}`,
      scrollTarget: MOJE_ACTION_SECTION,
      count: pickupLineCount,
      ctaLabel: "Przejdź",
    });
  } else if (pickupLineCount === 1 && pickupGroups[0]) {
    const group = pickupGroups[0];
    items.push({
      id: `pickup-${group.supplierName}`,
      source: "pickup",
      priority: PRIORITY.pickup,
      title: group.supplierName,
      subtitle: "1 pozycja gotowa",
      href: `/moje#${MOJE_ACTION_SECTION}`,
      scrollTarget: MOJE_ACTION_SECTION,
      count: 1,
      ctaLabel: "Potwierdź",
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
  previewDla?: string | null,
  unseenWarehouseWatchIds?: Set<string> | string[]
): SalesDayStartItem[] {
  const tasks = collectNotepadTodayTasks(watches, notes, { unseenWarehouseWatchIds });

  return tasks.map((task) => {
    const isZkTask =
      task.kind === "zk-follow-up" || task.kind === "zk-warehouse-arrival";
    const watchId =
      isZkTask && task.anchor.startsWith("watch-") ? task.anchor.slice(6) : null;
    return {
      id: `${task.kind}-${task.id}`,
      source: isZkTask ? "zk_follow_up" : "note_follow_up",
      priority: isZkTask ? PRIORITY.zk_follow_up : PRIORITY.note_follow_up,
      title: isZkTask
        ? task.kind === "zk-warehouse-arrival"
          ? `Na magazynie · ${formatProsbaZkLinkNumber(task.title)}`
          : `Przypomnienie · ${formatProsbaZkLinkNumber(task.title)}`
        : task.title,
      subtitle: task.subtitle ?? undefined,
      evidence: task.subtitle ?? undefined,
      href: buildNotatnikPageHref({
        tab: isZkTask ? "zk" : "notes",
        surface: isZkTask ? "zk" : "notes",
        hash: task.anchor,
        focusWatch: watchId,
        extraParams: previewDla ? { dla: previewDla } : undefined,
      }),
      count: 1,
      ctaLabel: isZkTask ? "ZK czekające" : "Notatki",
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
    const latestId = board.unreadAnnouncementBannerLatestId;
    const href =
      board.unreadAnnouncementBannerCount === 1 && latestId
        ? `/tablica${previewQs}${previewQs ? "&" : "?"}widok=ogloszenia&watek=${encodeURIComponent(latestId)}`
        : `/tablica${previewQs}${previewQs ? "&" : "?"}widok=ogloszenia`;

    items.push({
      id: "board-announcements",
      source: "board_announcement",
      priority: PRIORITY.board_announcement,
      title:
        board.unreadAnnouncementBannerCount === 1
          ? "Nowe ogłoszenie od zakupów"
          : `${board.unreadAnnouncementBannerCount} nowe ogłoszenia`,
      subtitle: board.unreadAnnouncementBannerLatestTitle ?? undefined,
      href,
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
  unseenWarehouseWatchIds?: Set<string> | string[];
}): SalesDayStartSnapshot {
  const { rows, watches = [], notes = [], boardAttention, previewDla, unseenWarehouseWatchIds } =
    input;
  const inboxSummary = summarizeMyOrdersInbox(rows);

  const orderItems = buildOrderActionItems(rows);
  const notepadItems = buildNotepadItems(watches, notes, previewDla, unseenWarehouseWatchIds);
  const boardItems = boardAttention ? buildBoardItems(boardAttention, previewDla) : [];

  const items = [...orderItems, ...notepadItems, ...boardItems].sort(
    (a, b) => a.priority - b.priority || (b.count ?? 0) - (a.count ?? 0)
  );

  const totalActionCount =
    inboxSummary.pickupCount +
    inboxSummary.cancelAckCount +
    inboxSummary.informacjaReadyCount +
    notepadItems.length +
    boardItems.reduce((sum, i) => sum + (i.count ?? 1), 0);

  return {
    items,
    totalActionCount,
    cleared: totalActionCount === 0,
  };
}

export function salesDayStartSourceLabel(source: SalesDayStartSource): string {
  switch (source) {
    case "pickup":
      return "Gotowe";
    case "cancel_ack":
      return "Anulowanie";
    case "informacja_ready":
      return "Do potwierdzenia";
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

export function sliceSalesDayStartItems(
  items: SalesDayStartItem[],
  expanded: boolean,
  limit = SALES_DAY_START_VISIBLE_LIMIT
): { visible: SalesDayStartItem[]; hiddenCount: number } {
  if (expanded || items.length <= limit) {
    return { visible: items, hiddenCount: 0 };
  }
  return { visible: items.slice(0, limit), hiddenCount: items.length - limit };
}
