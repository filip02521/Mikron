import { parseDateOnly, formatDateString } from "@/lib/orders/dates";
import { isPastExpectedDate } from "@/lib/orders/delivery-eta";
import {
  isZdEtaSyncEligible,
} from "@/lib/subiekt/zd-eta-sync";
import type { ZdFulfillmentDeadlineChangeDisplay } from "@/lib/orders/zd-fulfillment-deadline-change";
import { resolveZdFulfillmentDeadlineChangeDisplay } from "@/lib/orders/zd-fulfillment-deadline-change";
import { pickLatestZdFulfillmentDeadlineChange } from "@/lib/orders/zd-fulfillment-deadline-change";
import { resolvePlaceholderZdFulfillmentDeadlineFromOrder } from "@/lib/orders/zd-fulfillment-placeholder-deadline";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { DeliveryStats, IndividualOrder, StatsMode } from "@/types/database";
import { formatProsbaZkLinkNumber } from "@/lib/orders/zk-prosba-link-display";
import {
  INFORMACJA_FLOW_SALES_READY_ACK_HEADLINE,
  isInformacjaAvailabilityPendingStatusTitle,
} from "@/lib/orders/informacja-flow-copy";
import { progressLabelInSubline } from "@/lib/orders/my-order-card-ui";
import { isRequestNotesAggregateSummary } from "@/lib/orders/sales-request-note";
import { isClientNamesAggregateSummary } from "@/lib/orders/sales-client-label";
import {
  isProcurementCancelNotesAggregateSummary,
  procurementCancelNotesMojeSublineSuffix,
} from "@/lib/orders/procurement-cancel-note";
import {
  MY_ORDER_HISTORY_ESTIMATE_LOW_CONFIDENCE_DETAIL,
  MY_ORDER_NO_HISTORY_ESTIMATE_YET_SUBLINE,
} from "@/lib/orders/my-order-history-estimate-copy";
import {
  ZD_ETA_OVERDUE_NO_MATCH_SUBLINE,
  ZD_ETA_OVERDUE_PENDING_SUBLINE,
} from "@/lib/orders/my-order-zd-eta-copy";

export type SupplierKhIdsLookup = Record<string, readonly number[]>;

function orderSupplierHasSubiektKh(
  order: Pick<IndividualOrder, "supplier_id" | "supplier">,
  supplierKhIdsBySupplierId?: SupplierKhIdsLookup
): boolean {
  const sid = order.supplier_id;
  if (sid && (supplierKhIdsBySupplierId?.[sid]?.length ?? 0) > 0) return true;
  const kh = order.supplier?.subiekt_kh_id;
  return kh != null && Number.isFinite(kh) && kh > 0;
}

export type MyOrderHeadlineTone =
  | "action"
  | "informacja"
  | "warning"
  | "stock"
  | "success"
  | "info"
  | "neutral"
  | "dismiss";

/** Nagłówek wiersza przy częściowej dostawie z towarem na magazynie (bez potwierdzenia odbioru). */
export const MY_ORDER_PARTIAL_STOCK_HEADLINE = "Część towaru na magazynie";

export function isMyOrderPartialStockRow(row: MyOrderRow): boolean {
  if (row.kind !== "zamowienie" || row.statusTitle !== "Częściowo na magazynie") {
    return false;
  }
  return enrichMyOrderSalesUi(row).headlineTone === "stock";
}

/** Status otwartej prośby przekazanej do działu dostaw (nie wymaga akcji handlowca). */
export function isProsbaHandoffStatus(statusTitle: string): boolean {
  return (
    statusTitle === "W dziale dostaw" ||
    statusTitle === "Dopasowujemy dostawcę" ||
    statusTitle === "Uzupełnianie danych"
  );
}

/** Jedna linia pod nagłówkiem — bez powtórzenia statusDetail w rozwinięciu. */
export function verificationSublineFromDetail(statusDetail: string | null): string {
  if (!statusDetail?.trim()) return "Zakupy dopracują szczegóły — bez Twojej akcji";
  if (
    statusDetail.includes("Szukamy dostawcy") ||
    statusDetail.includes("dopasowuje dostawcę")
  ) {
    return "Trwa dopasowanie dostawcy w systemie";
  }
  if (statusDetail.includes("Dział dostaw dopasuje dostawcę")) {
    return "Zakupy dopasują dostawcę — bez Twojej akcji";
  }
  if (statusDetail.includes("Dział dostaw uzupełni:")) {
    const match = statusDetail.match(/Dział dostaw uzupełni: ([^.]+)/);
    return match ? `Zakupy uzupełnią ${match[1]}` : "Zakupy dopracują szczegóły";
  }
  if (statusDetail.includes("nie musisz")) {
    return "Prośba zapisana — bez Twojej akcji";
  }
  if (statusDetail.startsWith("Brakuje:")) {
    const missing = statusDetail.slice("Brakuje:".length).split(".")[0]?.trim();
    return missing
      ? `Zakupy uzupełnią ${missing}`
      : "Zakupy dopracują szczegóły — bez Twojej akcji";
  }
  if (statusDetail.includes("sprawdzają")) return "Zakupy sprawdzają szczegóły przed zamówieniem";
  return "Zakupy dopracują szczegóły — bez Twojej akcji";
}

export type MyOrderSalesUi = {
  /** Najważniejsza informacja na karcie — co się dzieje / co zrobić. */
  headline: string;
  headlineTone: MyOrderHeadlineTone;
  /** Krótka podpowiedź pod nagłówkiem (opcjonalnie). */
  subline: string | null;
  /** Kolejność na liście — mniejsza liczba = wyżej. */
  sortPriority: number;
};

export type MyOrdersInboxSummary = {
  pickupCount: number;
  partialReadyCount: number;
  cancelAckCount: number;
  overdueCount: number;
  verificationCount: number;
  przedZamowieniemCount: number;
  zamowioneCount: number;
  availabilityPendingCount: number;
  informacjaReadyCount: number;
};

/** Podsumowanie skrzynki na górze „Moje zamówienia”. */
export function summarizeMyOrdersInbox(rows: MyOrderRow[]): MyOrdersInboxSummary {
  const s: MyOrdersInboxSummary = {
    pickupCount: 0,
    partialReadyCount: 0,
    cancelAckCount: 0,
    overdueCount: 0,
    verificationCount: 0,
    przedZamowieniemCount: 0,
    zamowioneCount: 0,
    availabilityPendingCount: 0,
    informacjaReadyCount: 0,
  };

  for (const row of rows) {
    const ui = enrichMyOrderSalesUi(row);
    if (ui.sortPriority === 1) s.pickupCount++;
    else if (row.kind === "zamowienie" && row.statusTitle === "Częściowo na magazynie") {
      s.partialReadyCount++;
    }
    else if (ui.sortPriority === 3) s.cancelAckCount++;
    else if (ui.sortPriority === 4) s.overdueCount++;
    else if (ui.sortPriority === 5) s.verificationCount++;
    else if (ui.sortPriority === 10) s.informacjaReadyCount++;
    else if (row.kind === "zamowienie" && row.statusTitle === "Przed zamówieniem") {
      s.przedZamowieniemCount++;
    } else if (row.kind === "zamowienie" && row.statusTitle === "Zamówione") {
      s.zamowioneCount++;
    } else if (
      row.kind === "informacja" &&
      (isInformacjaAvailabilityPendingStatusTitle(row.statusTitle) ||
        row.statusTitle === "Czekamy na zamówienie u dostawcy" ||
        row.statusTitle === "Zamówione — czekamy na magazyn")
    ) {
      s.availabilityPendingCount++;
    }
  }

  return s;
}

export function enrichMyOrderSalesUi(row: MyOrderRow): MyOrderSalesUi {
  const overdue = Boolean(row.timingLabel?.includes("po terminie"));

  if (row.acknowledgeMode === "availability" && row.pickupPendingCount > 0) {
    return {
      headline: INFORMACJA_FLOW_SALES_READY_ACK_HEADLINE,
      headlineTone: "informacja",
      subline: "Potwierdź, że widziałeś/aś e-mail od magazynu",
      sortPriority: 10,
    };
  }

  if (row.acknowledgeMode === "pickup" && row.pickupPendingCount > 0) {
    const n = row.pickupPendingCount;
    return {
      headline:
        n === 1
          ? "Gotowe do odbioru z regału"
          : `Gotowe do odbioru z regału · ${n} poz.`,
      headlineTone: "action",
      subline: null,
      sortPriority: 1,
    };
  }

  if (row.acknowledgeMode === "teeth_handover" && row.pickupPendingCount > 0) {
    const n = row.pickupPendingCount;
    return {
      headline:
        n === 1 ? "Zęby gotowe do odbioru" : `Zęby gotowe do odbioru · ${n} poz.`,
      headlineTone: "action",
      subline: "Doręczenie osobiste — potwierdź odbiór od magazynu",
      sortPriority: 1,
    };
  }

  if (
    row.acknowledgeMode === "cancel_notice" &&
    row.cancelNoticeOrderIds.length > 0
  ) {
    return {
      headline: "Potwierdź informację o rezygnacji",
      headlineTone: "dismiss",
      subline: "Po potwierdzeniu wpis zniknie z listy",
      sortPriority: 3,
    };
  }

  if (row.acknowledgeMode === "cancelled") {
    const noteSuffix = procurementCancelNotesMojeSublineSuffix(row.lines);
    return {
      headline: "Potwierdź anulowanie prośby",
      headlineTone: "dismiss",
      subline: `Po potwierdzeniu wpis zniknie z listy${noteSuffix}`,
      sortPriority: 3,
    };
  }

  if (row.statusTitle === "Częściowo na magazynie") {
    const onStock = row.lines.filter(
      (l) => l.stockStatus === "on_stock" || l.stockStatus === "partial"
    ).length;
    const zdOverdue =
      row.zdFulfillment &&
      row.timingLabel?.includes("po terminie") &&
      parseDateOnly(row.zdFulfillment.deadline) != null &&
      isPastExpectedDate(parseDateOnly(row.zdFulfillment.deadline)!);
    return {
      headline:
        onStock > 0
          ? MY_ORDER_PARTIAL_STOCK_HEADLINE
          : "Częściowa dostawa w toku",
      headlineTone: onStock > 0 ? "stock" : "info",
      subline: zdOverdue
        ? [
            row.progressLabel
              ? `Magazyn: ${row.progressLabel.replace(" na magazynie", "")}`
              : null,
            row.timingLabel?.replace(/\s*·\s*po terminie\s*/i, "").trim(),
          ]
            .filter(Boolean)
            .join(" · ")
        : row.progressLabel
          ? `Magazyn: ${row.progressLabel.replace(" na magazynie", "")}`
          : null,
      sortPriority: onStock > 0 ? 2 : 6,
    };
  }

  if (overdue) {
    const zd = row.zdFulfillment;
    if (row.zdEtaPending) {
      return {
        headline: "Po przewidywanym terminie",
        headlineTone: "warning",
        subline: ZD_ETA_OVERDUE_PENDING_SUBLINE,
        sortPriority: 4,
      };
    }
    if (row.zdEtaNoMatch) {
      return {
        headline: "Po przewidywanym terminie",
        headlineTone: "warning",
        subline: ZD_ETA_OVERDUE_NO_MATCH_SUBLINE,
        sortPriority: 4,
      };
    }
    return {
      headline: zd ? "Po terminie u dostawcy" : "Po przewidywanym terminie",
      headlineTone: "warning",
      subline: null,
      sortPriority: 4,
    };
  }

  if (isProsbaHandoffStatus(row.statusTitle)) {
    const pending = row.statusTitle === "Dopasowujemy dostawcę";
    return {
      headline: pending ? "Dopasowujemy dostawcę" : "Prośba jest weryfikowana",
      headlineTone: "info",
      subline: verificationSublineFromDetail(row.statusDetail),
      sortPriority: 5,
    };
  }

  if (row.statusTitle === "Zamówione") {
    const hasEstimate = Boolean(row.timingLabel);
    const lowHistory = row.timingLabel?.includes("mało historii");
    return {
      headline: hasEstimate
        ? "Zamówione — czekamy na dostawę"
        : "Zamówione u dostawcy",
      headlineTone: "info",
      subline: !hasEstimate
        ? MY_ORDER_NO_HISTORY_ESTIMATE_YET_SUBLINE
        : lowHistory
          ? MY_ORDER_HISTORY_ESTIMATE_LOW_CONFIDENCE_DETAIL
          : null,
      sortPriority: 7,
    };
  }

  if (row.statusTitle === "Przed zamówieniem") {
    return {
      headline: "Czeka na zamówienie u dostawcy",
      headlineTone: "neutral",
      subline: "Dział dostaw złoży zamówienie planowo lub osobno",
      sortPriority: 8,
    };
  }

  if (row.statusTitle === "Czekamy na zamówienie u dostawcy") {
    return {
      headline: "Zamówimy u dostawcy",
      headlineTone: "info",
      subline: "Potem magazyn i powiadomienie e-mail",
      sortPriority: 9,
    };
  }

  if (isInformacjaAvailabilityPendingStatusTitle(row.statusTitle)) {
    return {
      headline: "Powiadomimy, gdy towar przyjedzie",
      headlineTone: "neutral",
      subline: "Magazyn obserwuje dostępność — bez zamówienia u dostawcy",
      sortPriority: 9,
    };
  }

  if (row.statusTitle === "Zamówione — czekamy na magazyn") {
    return {
      headline: "Zamówione u dostawcy",
      headlineTone: "info",
      subline: "Powiadomimy e-mailem, gdy towar będzie na magazynie",
      sortPriority: 9,
    };
  }

  return {
    headline: row.statusTitle,
    headlineTone: row.badgeVariant === "success" ? "success" : "neutral",
    subline: null,
    sortPriority: 50,
  };
}

export function sortMyOrderRows(rows: MyOrderRow[]): MyOrderRow[] {
  return [...rows].sort((a, b) => {
    const pa = enrichMyOrderSalesUi(a).sortPriority;
    const pb = enrichMyOrderSalesUi(b).sortPriority;
    if (pa !== pb) return pa - pb;
    return b.submittedLabel.localeCompare(a.submittedLabel, "pl");
  });
}

/** Etykiety metadanych na karcie (zamiast jednego ciągu „·”). */
export function myOrderMetaFields(
  row: MyOrderRow,
  showProgress: boolean
): { label: string; value: string; emphasize?: boolean }[] {
  const fields: { label: string; value: string; emphasize?: boolean }[] = [
    { label: "Zgłoszono", value: row.submittedLabel },
  ];

  if (row.clientLabel && !isClientNamesAggregateSummary(row.clientLabel)) {
    fields.push({
      label: "Klient",
      value: row.clientLabel,
      emphasize: true,
    });
  }

  if (row.requestNote && !isRequestNotesAggregateSummary(row.requestNote)) {
    fields.push({
      label: "Uwagi",
      value: row.requestNote,
      emphasize: true,
    });
  }

  if (row.procurementCancelNote && !isProcurementCancelNotesAggregateSummary(row.procurementCancelNote)) {
    fields.push({
      label: "Od dostaw",
      value: row.procurementCancelNote,
      emphasize: true,
    });
  }

  if (row.sourceZkNumber?.trim()) {
    fields.push({
      label: "ZK",
      value: formatProsbaZkLinkNumber(row.sourceZkNumber),
    });
  }

  if (showProgress && row.progressLabel && !progressLabelInSubline(row)) {
    fields.push({
      label: "Magazyn",
      value: row.progressLabel.replace(" na magazynie", "").replace("Wszystkie ", ""),
      emphasize: row.statusTitle.includes("magazynie") || row.statusTitle.includes("Część"),
    });
  }

  return fields;
}

export type MyOrderMetaField = { label: string; value: string; emphasize?: boolean };

/** Rozbija statusDetail na pola metadanych i resztę do osobnej notatki. */
export function parseStatusDetailMetaParts(statusDetail: string | null): {
  orderTypeLabel: string | null;
  orderedAtLabel: string | null;
  remainder: string | null;
} {
  if (!statusDetail?.trim()) {
    return { orderTypeLabel: null, orderedAtLabel: null, remainder: null };
  }

  const segments = statusDetail.split(" · ").map((s) => s.trim()).filter(Boolean);
  let orderTypeLabel: string | null = null;
  let orderedAtLabel: string | null = null;
  const remainder: string[] = [];

  for (const segment of segments) {
    if (segment.startsWith("Osobne domówienie")) {
      orderTypeLabel = "Poza planem";
    } else if (segment.startsWith("W planowej dostawie")) {
      orderTypeLabel = "Planowa dostawa";
    } else if (/^Zamówiono \d/.test(segment)) {
      const afterZamowiono = segment.slice("Zamówiono ".length);
      const dateMatch = afterZamowiono.match(/^(\d{2}\.\d{2}\.\d{4})/);
      if (dateMatch) {
        orderedAtLabel = dateMatch[1]!;
        const rest = afterZamowiono.slice(dateMatch[1].length).trim();
        if (rest) remainder.push(rest.replace(/^[.\s]+/, ""));
      } else {
        orderedAtLabel = afterZamowiono;
      }
    } else if (/wspólny termin/i.test(segment)) {
      remainder.push(segment);
    } else {
      remainder.push(segment);
    }
  }

  return {
    orderTypeLabel,
    orderedAtLabel,
    remainder: remainder.length ? remainder.join(" · ") : null,
  };
}

/** Subline już pokryty przez timingLabel lub szacunek w metadanych. */
export function isExpandedSublineRedundant(row: MyOrderRow): boolean {
  if (!row.subline?.trim()) return false;
  if (row.timingLabel) {
    const sub = row.subline.replace(" · po terminie", "").trim();
    const timing = row.timingLabel.replace(" · po terminie", "").trim();
    if (sub === timing) return true;
  }
  if (
    row.subline.includes("Mało dostaw w historii") &&
    row.timingLabel?.includes("mało historii")
  ) {
    return true;
  }
  if (
    row.statusTitle === "Zamówione" &&
    row.subline.includes("Mało dostaw w historii") &&
    row.timingLabel?.trim()
  ) {
    return true;
  }
  return false;
}

/** Metadane rozwinięcia — typ/zamówienie ze statusDetail bez osobnego calloutu. */
export function myOrderExpandedMetaFields(
  row: MyOrderRow,
  showProgress: boolean
): MyOrderMetaField[] {
  const fields = myOrderMetaFields(row, showProgress);
  const parsed = parseStatusDetailMetaParts(row.statusDetail);

  let insertIndex = 1;
  if (parsed.orderTypeLabel) {
    fields.splice(insertIndex, 0, { label: "Typ", value: parsed.orderTypeLabel });
    insertIndex++;
  }
  if (parsed.orderedAtLabel && parsed.orderedAtLabel !== row.submittedLabel) {
    fields.splice(insertIndex, 0, {
      label: "Zamówiono",
      value: parsed.orderedAtLabel,
    });
  }

  return fields;
}

export function isTimingOverdue(timingLabel: string | null): boolean {
  if (!timingLabel?.includes("po terminie")) return false;
  return true;
}

export type MyOrderZdFulfillmentSlot = {
  deadline: string;
  dokNr: string;
  count: number;
  /** Termin z dnia złożenia — czekamy na korektę działu dostaw. */
  pendingConfirmation?: boolean;
};

export type MyOrderZdFulfillment = {
  deadline: string;
  dokNr: string;
  syncedAt: string | null;
  source: "zd";
  /** Różne terminy w grupie u dostawcy — posortowane od najbliższego. */
  slots?: MyOrderZdFulfillmentSlot[];
  /** Zmiana terminu wykryta przy ostatnim sync ZD. */
  deadlineChange?: ZdFulfillmentDeadlineChangeDisplay | null;
  /** Termin ZD = dzień złożenia u dostawcy, jeszcze bez potwierdzenia. */
  pendingConfirmation?: boolean;
};

function hasStoredZdFulfillmentDeadline(
  order: Pick<IndividualOrder, "zd_fulfillment_source" | "zd_fulfillment_deadline">
): boolean {
  if (order.zd_fulfillment_source !== "zd") return false;
  const deadline = order.zd_fulfillment_deadline?.trim();
  return Boolean(deadline && parseDateOnly(deadline));
}

export function resolveZdFulfillmentFromOrder(
  order: Pick<
    IndividualOrder,
    | "zd_fulfillment_deadline"
    | "zd_fulfillment_source"
    | "zd_fulfillment_dok_nr"
    | "zd_fulfillment_synced_at"
    | "zd_fulfillment_previous_deadline"
    | "zd_fulfillment_deadline_changed_at"
    | "zd_fulfillment_deadline_change_seen_at"
    | "ordered_at"
    | "action_at"
    | "status"
  >,
  at: Date = new Date()
): MyOrderZdFulfillment | null {
  if (order.zd_fulfillment_source !== "zd") return null;
  const deadline = order.zd_fulfillment_deadline?.trim();
  if (!deadline || !parseDateOnly(deadline)) return null;
  const dokNr = order.zd_fulfillment_dok_nr?.trim();
  const deadlineChange = resolveZdFulfillmentDeadlineChangeDisplay(order, at);
  const pendingConfirmation = resolvePlaceholderZdFulfillmentDeadlineFromOrder(order);
  return {
    deadline,
    dokNr: dokNr || "ZD",
    syncedAt: order.zd_fulfillment_synced_at ?? null,
    source: "zd",
    deadlineChange,
    pendingConfirmation,
  };
}

function supplierHasPrimarySubiektKh(
  order: Pick<IndividualOrder, "supplier_id" | "supplier">,
  supplierKhIdsBySupplierId?: SupplierKhIdsLookup
): boolean {
  return orderSupplierHasSubiektKh(order, supplierKhIdsBySupplierId);
}

/** UI: sync ZD jeszcze nie zakończył się — pokaż stan oczekiwania zamiast samego ETA. */
export function resolveZdEtaPendingFromOrder(
  order: IndividualOrder,
  stats: DeliveryStats | undefined,
  statsMode: StatsMode,
  supplierKhIdsBySupplierId?: SupplierKhIdsLookup,
  subiektReachable = true
): boolean {
  if (!subiektReachable) return false;
  if (resolveZdFulfillmentFromOrder(order)) return false;
  if (order.zd_fulfillment_synced_at) return false;
  if (!supplierHasPrimarySubiektKh(order, supplierKhIdsBySupplierId)) return false;
  return isZdEtaSyncEligible(order);
}

/** UI: sync zakończony bez dopasowanego ZD — subtelna informacja zamiast ciszy. */
export function resolveZdEtaNoMatchFromOrder(
  order: IndividualOrder,
  stats: DeliveryStats | undefined,
  statsMode: StatsMode,
  supplierKhIdsBySupplierId?: SupplierKhIdsLookup
): boolean {
  if (resolveZdFulfillmentFromOrder(order)) return false;
  if (hasStoredZdFulfillmentDeadline(order)) return false;
  if (!order.zd_fulfillment_synced_at) return false;
  if (!supplierHasPrimarySubiektKh(order, supplierKhIdsBySupplierId)) return false;
  return isZdEtaSyncEligible(order);
}

/** Etykieta terminu z dopasowanego dokumentu ZD (Moje zamówienia). */
export function salesZdTimingLabel(
  deadline: string,
  dokNr: string,
  overdue: boolean
): string {
  const parsed = parseDateOnly(deadline);
  const date = parsed
    ? formatDateString(parsed, "dd.MM.yyyy")
    : deadline;
  const overdueSuffix = overdue ? " · po terminie" : "";
  return `${date} · ${dokNr}${overdueSuffix}`;
}

/** Łączy terminy ZD wielu pozycji grupy — najwcześniejszy termin, pending jeśli któraś czeka. */
export function aggregateGroupZdEtaState(
  orders: IndividualOrder[],
  statsBySupplier: Record<string, DeliveryStats>,
  supplierKhIdsBySupplierId?: SupplierKhIdsLookup,
  subiektReachable = true
): {
  zdFulfillment: MyOrderZdFulfillment | null;
  zdEtaPending: boolean;
  zdEtaNoMatch: boolean;
} {
  const fulfillments: MyOrderZdFulfillment[] = [];
  let anyPending = false;
  let anyNoMatch = false;

  for (const order of orders) {
    const stats = order.supplier_id ? statsBySupplier[order.supplier_id] : undefined;
    const statsMode = (order.supplier?.stats_mode ?? "LACZNIE") as StatsMode;
    const zd = resolveZdFulfillmentFromOrder(order);
    if (zd) {
      fulfillments.push(zd);
      continue;
    }
    if (resolveZdEtaPendingFromOrder(order, stats, statsMode, supplierKhIdsBySupplierId, subiektReachable)) {
      anyPending = true;
      continue;
    }
    if (resolveZdEtaNoMatchFromOrder(order, stats, statsMode, supplierKhIdsBySupplierId)) {
      anyNoMatch = true;
    }
  }

  if (fulfillments.length === 0) {
    return { zdFulfillment: null, zdEtaPending: anyPending, zdEtaNoMatch: anyNoMatch };
  }

  const slotMap = new Map<string, MyOrderZdFulfillmentSlot>();
  for (const f of fulfillments) {
    const key = `${f.deadline}|${f.dokNr}`;
    const existing = slotMap.get(key);
    if (existing) {
      existing.count += 1;
      if (!f.pendingConfirmation) existing.pendingConfirmation = false;
    } else {
      slotMap.set(key, {
        deadline: f.deadline,
        dokNr: f.dokNr,
        count: 1,
        pendingConfirmation: f.pendingConfirmation ?? false,
      });
    }
  }

  const slots = [...slotMap.values()].sort((a, b) => {
    const da = parseDateOnly(a.deadline);
    const db = parseDateOnly(b.deadline);
    if (da && db) return da.getTime() - db.getTime();
    return a.deadline.localeCompare(b.deadline);
  });

  const primary = slots[0]!;
  const syncedAt =
    fulfillments
      .map((f) => f.syncedAt)
      .filter((v): v is string => Boolean(v?.trim()))
      .sort()
      .reverse()[0] ?? null;
  const deadlineChange = pickLatestZdFulfillmentDeadlineChange(orders);
  const pendingConfirmation =
    primary.pendingConfirmation ?? fulfillments.every((f) => f.pendingConfirmation);

  return {
    zdFulfillment: {
      deadline: primary.deadline,
      dokNr: primary.dokNr,
      syncedAt,
      source: "zd",
      slots: slots.length > 1 ? slots : undefined,
      deadlineChange,
      pendingConfirmation,
    },
    zdEtaPending: anyPending,
    zdEtaNoMatch: anyNoMatch,
  };
}

/** Używane w presenterze przy budowie timingLabel z ETA. */
export function salesTimingLabel(
  expectedDate: Date,
  avgDays: number,
  lowConfidence: boolean
): string {
  const date = formatDateString(expectedDate, "dd.MM.yyyy");
  const conf = lowConfidence ? " · mało historii" : "";
  const overdue = isPastExpectedDate(expectedDate) ? " · po terminie" : "";
  return `ok. ${date} (~${avgDays} dni rob.)${conf}${overdue}`;
}
