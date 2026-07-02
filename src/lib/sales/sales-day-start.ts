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
import { appendMojeFocusOrderIds } from "@/lib/orders/moje-order-focus";
import { mojeSectionDomId } from "@/lib/orders/moje-section-focus";
import { MOJE_TEETH_ACTION_SECTION_ID } from "@/lib/orders/my-order-inbox-sections";
import type { SalesNote, SalesZkWatch } from "@/types/database";

export type SalesDayStartSource =
  | "pickup"
  | "teeth_handover"
  | "zk_warehouse"
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
  teeth_handover: 12,
  zk_warehouse: 15,
  cancel_ack: 20,
  informacja_ready: 30,
  zk_follow_up: 40,
  note_follow_up: 50,
  board_answer: 60,
  board_announcement: 70,
};

const MOJE_ACTION_SECTION = mojeSectionDomId("action");
const MOJE_INFORMACJA_SECTION = mojeSectionDomId("informacja");

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

function countTeethHandoverLines(rows: MyOrderRow[]): number {
  let total = 0;
  for (const row of rows) {
    if (row.acknowledgeMode !== "teeth_handover" || row.pickupPendingIds.length === 0) continue;
    total += row.pickupPendingIds.length;
  }
  return total;
}

function groupTeethHandoverBySupplier(
  rows: MyOrderRow[]
): { supplierName: string; lineCount: number }[] {
  const bySupplier = new Map<string, number>();
  for (const row of rows) {
    if (row.acknowledgeMode !== "teeth_handover" || row.pickupPendingIds.length === 0) continue;
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
      title: `Potwierdź odbiór z regału (${pickupLineCount})`,
      subtitle: "Produkty czekają na regale — potwierdź odbiór",
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
      subtitle: "1 pozycja na regale — potwierdź odbiór",
      href: `/moje#${MOJE_ACTION_SECTION}`,
      scrollTarget: MOJE_ACTION_SECTION,
      count: 1,
      ctaLabel: "Potwierdź",
    });
  }

  const teethGroups = groupTeethHandoverBySupplier(actionRows);
  const teethLineCount = countTeethHandoverLines(actionRows);

  if (teethLineCount >= PICKUP_AGGREGATE_FROM) {
    items.push({
      id: "teeth-handover-ready",
      source: "teeth_handover",
      priority: PRIORITY.teeth_handover,
      title: `Potwierdź odbiór zębów (${teethLineCount})`,
      subtitle: "Doręczenie osobiste od magazynu — nie na regał",
      href: `/moje#${MOJE_TEETH_ACTION_SECTION_ID}`,
      scrollTarget: MOJE_TEETH_ACTION_SECTION_ID,
      count: teethLineCount,
      ctaLabel: "Przejdź",
    });
  } else if (teethLineCount === 1 && teethGroups[0]) {
    const group = teethGroups[0];
    items.push({
      id: `teeth-handover-${group.supplierName}`,
      source: "teeth_handover",
      priority: PRIORITY.teeth_handover,
      title: group.supplierName,
      subtitle: "Zęby gotowe — potwierdź osobisty odbiór",
      href: `/moje#${MOJE_TEETH_ACTION_SECTION_ID}`,
      scrollTarget: MOJE_TEETH_ACTION_SECTION_ID,
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
    const firstOrderId = informacjaRows[0]?.orderIds[0];
    const baseHref = `/moje#${MOJE_INFORMACJA_SECTION}`;
    const href =
      n === 1 && firstOrderId
        ? appendMojeFocusOrderIds(baseHref, [firstOrderId])
        : baseHref;
    items.push({
      id: "informacja-ready",
      source: "informacja_ready",
      priority: PRIORITY.informacja_ready,
      title:
        n === 1
          ? "Potwierdź informację o dotarciu produktów"
          : `Potwierdź informacje o dotarciu produktów (${n})`,
      subtitle: "Zakupy potwierdziły dotarcie — potwierdź informację",
      href,
      scrollTarget: MOJE_INFORMACJA_SECTION,
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
    const isZkWarehouse = task.kind === "zk-warehouse-arrival";
    const isZkTask = isZkWarehouse || task.kind === "zk-follow-up";
    const watchId =
      isZkTask && task.anchor.startsWith("watch-") ? task.anchor.slice(6) : null;
    return {
      id: `${task.kind}-${task.id}`,
      source: isZkWarehouse
        ? "zk_warehouse"
        : isZkTask
          ? "zk_follow_up"
          : "note_follow_up",
      priority: isZkWarehouse
        ? PRIORITY.zk_warehouse
        : isZkTask
          ? PRIORITY.zk_follow_up
          : PRIORITY.note_follow_up,
      title: isZkWarehouse
        ? `Na magazynie · ${formatProsbaZkLinkNumber(task.title)}`
        : task.kind === "zk-follow-up"
          ? `Przypomnienie · ${formatProsbaZkLinkNumber(task.title)}`
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
  const ownAnswerCount = board.unseenOwnAnswerCount;
  const ownQuestionIds = board.unseenOwnQuestionIds ?? [];

  if (ownAnswerCount > 0) {
    const preview =
      board.unseenAnswerPreview?.isOwnQuestion ? board.unseenAnswerPreview : null;
    const singleThreadId = preview?.threadId ?? ownQuestionIds[0] ?? null;
    const href =
      ownAnswerCount === 1 && singleThreadId
        ? `/tablica${previewQs}${previewQs ? "&" : "?"}watek=${singleThreadId}`
        : `/tablica${previewQs}${previewQs ? "&" : "?"}filtr=own_unseen`;

    items.push({
      id: "board-answers",
      source: "board_answer",
      priority: PRIORITY.board_answer,
      title:
        ownAnswerCount === 1
          ? "Zakupy odpowiedziały na Twoje pytanie"
          : `Zakupy odpowiedziały na Twoje pytania (${ownAnswerCount})`,
      subtitle: preview?.title ? `„${preview.title}”` : undefined,
      href,
      count: ownAnswerCount,
      ctaLabel: "Tablica",
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
    case "teeth_handover":
      return "Zęby";
    case "zk_warehouse":
      return "Na regale";
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

/** Opis nagłówka panelu Start dnia — wszystkie typy zadań, nie tylko odbiór z regału. */
export function salesDayStartPanelDescription(totalActionCount: number): string {
  if (totalActionCount === 1) {
    return "1 pilna sprawa — od najważniejszych. Kliknij wiersz, aby przejść do listy lub modułu.";
  }
  return `${totalActionCount} pilnych spraw — od najważniejszych. Kliknij wiersz, aby przejść dalej.`;
}

/** Suma pozycji do zrobienia — uwzględnia agregację linii (np. „Potwierdź odbiór zębów (3)”). */
export function snapshotActionWeight(snapshot: SalesDayStartSnapshot): number {
  return snapshot.items.reduce((sum, item) => sum + (item.count ?? 1), 0);
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
