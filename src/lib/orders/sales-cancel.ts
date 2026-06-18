import {
  getDeliveryProgress,
  getOrderFulfillmentProgress,
  isInformacjaRequest,
  parseOrderQuantity,
  type DeliveryProgress,
  type OrderFulfillmentProgress,
} from "@/lib/orders/individual";
import type { IndividualOrder, IndividualOrderStatus } from "@/types/database";

export type SalesCancelPhase = "before_order" | "in_transit" | "on_stock";

const SALES_CANCEL_UNDO_HINT =
  "Przez kilka sekund możesz cofnąć tę operację (toast u dołu ekranu lub skrót ⌘Z / Ctrl+Z).";

/** Status po cofnięciu anulowania (before_order → było Anulowane). */
export function salesCancelUndoRestoreStatus(
  order: Pick<IndividualOrder, "status" | "request_kind">,
  phase: SalesCancelPhase
): IndividualOrderStatus | null {
  if (phase !== "before_order" || order.status !== "Anulowane") {
    return null;
  }
  return "Nowe";
}

/** Faza zapisana w DB lub wywnioskowana ze statusu (stare rekordy bez sales_cancel_phase). */
export function effectiveSalesCancelPhase(
  order: IndividualOrder
): SalesCancelPhase | null {
  if (!order.sales_cancelled_at) return null;

  const stored = order.sales_cancel_phase as SalesCancelPhase | null | undefined;
  if (
    stored === "before_order" ||
    stored === "in_transit" ||
    stored === "on_stock"
  ) {
    return stored;
  }

  if (order.status === "Anulowane") return "before_order";
  if (order.status === "Zrealizowane") return "on_stock";
  if (order.status === "Czesciowo_zrealizowane") {
    return deliveryProgressFor(order).delivered > 0 ? "on_stock" : "in_transit";
  }
  if (order.status === "Zamowione") return "in_transit";
  return "before_order";
}

export function deliveredQtyRaw(order: IndividualOrder): string {
  return order.delivered_quantity && order.delivered_quantity !== "-"
    ? order.delivered_quantity
    : "0";
}

export function deliveryProgressFor(order: IndividualOrder): DeliveryProgress {
  return getDeliveryProgress(order.quantity, deliveredQtyRaw(order));
}

export function fulfillmentProgressFor(order: IndividualOrder): OrderFulfillmentProgress {
  const cancelled = effectiveSalesCancelledQuantity(order);
  return getOrderFulfillmentProgress(
    order.quantity,
    deliveredQtyRaw(order),
    cancelled > 0 ? String(cancelled) : order.sales_cancelled_quantity
  );
}

/** Wycofane sztuki (0 gdy brak rezygnacji). */
export function effectiveSalesCancelledQuantity(order: IndividualOrder): number {
  const explicit = parseOrderQuantity(order.sales_cancelled_quantity ?? "");
  if (explicit != null && order.sales_cancelled_at) return explicit;
  if (!order.sales_cancelled_at) return 0;
  const ordered = parseOrderQuantity(order.quantity);
  if (ordered == null) return 0;
  if (order.status === "Anulowane") return ordered;
  const delivered = deliveryProgressFor(order).delivered;
  return Math.max(0, ordered - delivered);
}

/** Aktywne zamówienie = oryginał − wycofane. */
export function activeOrderQuantity(order: IndividualOrder): number | null {
  const ordered = parseOrderQuantity(order.quantity);
  if (ordered == null) return null;
  return Math.max(0, ordered - effectiveSalesCancelledQuantity(order));
}

/** Ilość jeszcze u dostawcy (bez tego, co już na magazynie). */
export function maxSupplierCancelQuantity(order: IndividualOrder): number {
  const ordered = parseOrderQuantity(order.quantity);
  if (ordered == null) return 0;
  const delivered = deliveryProgressFor(order).delivered;
  const alreadyCancelled = effectiveSalesCancelledQuantity(order);
  return Math.max(0, ordered - delivered - alreadyCancelled);
}

/** Maks. ilość do wycofania w bieżącej fazie. */
export function maxSalesCancelQuantity(order: IndividualOrder): number | null {
  const phase = resolveSalesCancelPhase(order);
  if (!phase) return null;

  /** Prośba informacyjna — zawsze pełne wycofanie (bez ilości sztuk). */
  if (isInformacjaRequest(order)) {
    return 1;
  }

  if (phase === "on_stock") {
    const active = activeOrderQuantity(order);
    if (active == null || active <= 0) return null;
    const supplierRemainder = maxSupplierCancelQuantity(order);
    if (supplierRemainder > 0) {
      return active;
    }
    return active;
  }

  const max = maxSupplierCancelQuantity(order);
  return max > 0 ? max : null;
}

/** Domyślna ilość rezygnacji (dla „reszty u dostawcy” lub pełnego wycofania). */
export function defaultSalesCancelQuantity(order: IndividualOrder): number | null {
  const phase = resolveSalesCancelPhase(order);
  if (phase === "on_stock") {
    const supplierRemainder = maxSupplierCancelQuantity(order);
    if (supplierRemainder > 0) return supplierRemainder;
  }
  return maxSalesCancelQuantity(order);
}

export function canPartialSalesCancel(order: IndividualOrder): boolean {
  const max = maxSalesCancelQuantity(order);
  return max != null && max > 1;
}

/** „Z reszty” tylko przy częściowej dostawie i więcej niż 1 szt. u dostawcy. */
export function shouldShowRemainderSpecificLabel(
  remainder: number,
  delivered: number
): boolean {
  return delivered > 0 && remainder > 1;
}

export function showSalesCancelRemainderAction(order: IndividualOrder): boolean {
  const delivered = deliveryProgressFor(order).delivered;
  const remainder = defaultSalesCancelQuantity(order);
  return (
    remainder != null &&
    remainder > 0 &&
    shouldShowRemainderSpecificLabel(remainder, delivered)
  );
}

/** Jedna szt. jeszcze u dostawcy po częściowej dostawie — skrót do „Zmień ilość”. */
export function showSalesCancelSupplierQuickAction(order: IndividualOrder): boolean {
  const delivered = deliveryProgressFor(order).delivered;
  const remainder = defaultSalesCancelQuantity(order);
  return delivered > 0 && remainder === 1;
}

/** Skrót częściowej zmiany ilości (reszta u dostawcy) — z liczbą sztuk gdy > 1. */
export function salesCancelLineRemainderLabel(remainder?: number): string {
  const base = salesCancelLineCustomQtyLabel();
  const n = remainder != null ? Math.max(1, Math.trunc(remainder)) : 0;
  return n > 1 ? `${base} (${n} szt.)` : base;
}

/** Opis dla czytników ekranu — z liczbą sztuk, gdy > 1. */
export function salesCancelLineRemainderAriaLabel(remainder: number): string {
  const n = Math.max(1, Math.trunc(remainder));
  const base = salesCancelLineCustomQtyLabel();
  return n > 1 ? `${base} (${n} szt.)` : base;
}

export function salesCancelLineCustomQtyLabel(): string {
  return "Zmień ilość";
}

/** Skrót częściowej zmiany ilości (np. ostatnia szt. u dostawcy). */
export function salesCancelQuickActionLabel(): string {
  return salesCancelLineCustomQtyLabel();
}

export type SalesCancelQuantityPlan = {
  /** Ilość wycofana w tej operacji. */
  cancelQty: number;
  /** Suma wycofanych sztuk po tej operacji. */
  totalCancelledQty: number;
  /** NULL = pełna rezygnacja wg dotychczasowych reguł (wsteczna kompatybilność). */
  storedCancelledQuantity: string | null;
  statusAfter?: IndividualOrderStatus;
  /** Linia zostaje aktywna u handlowca (bez archiwum / odbioru w toku). */
  keepLineActiveForSales: boolean;
};

export function planSalesCancelQuantity(
  order: IndividualOrder,
  requestedQty?: number
): SalesCancelQuantityPlan {
  const phase = resolveSalesCancelPhase(order);
  if (!phase) {
    throw new Error("Tej prośby nie można już wycofać.");
  }

  /** Prośba informacyjna — pełne wycofanie bez śledzenia ilości. */
  if (isInformacjaRequest(order)) {
    if (requestedQty != null && requestedQty !== 1) {
      throw new Error("Prośbę informacyjną można wycofać tylko w całości.");
    }
    return {
      cancelQty: 1,
      totalCancelledQty: 1,
      storedCancelledQuantity: null,
      statusAfter: phase === "before_order" ? "Anulowane" : undefined,
      keepLineActiveForSales: false,
    };
  }

  const delivered = deliveryProgressFor(order).delivered;
  const existingCancelled = effectiveSalesCancelledQuantity(order);
  const max = maxSalesCancelQuantity(order);
  if (max == null || max < 1) {
    throw new Error("Tej prośby nie można już wycofać.");
  }
  const cancelQty = requestedQty ?? max;
  if (!Number.isInteger(cancelQty) || cancelQty < 1 || cancelQty > max) {
    throw new Error(`Podaj ilość od 1 do ${max} szt.`);
  }

  const ordered = parseOrderQuantity(order.quantity);
  if (ordered == null) {
    throw new Error("Brak ilości liczbowej — możliwa tylko pełna rezygnacja.");
  }

  const totalCancelledQty = existingCancelled + cancelQty;
  const storedCancelledQuantity =
    totalCancelledQty >= ordered ? null : String(totalCancelledQty);

  let statusAfter: IndividualOrderStatus | undefined;
  if (phase === "before_order" && totalCancelledQty >= ordered) {
    statusAfter = "Anulowane";
  } else {
    const activeAfter = ordered - totalCancelledQty;
    if (delivered > 0 && delivered >= activeAfter) {
      statusAfter = "Zrealizowane";
    }
  }

  const activeAfter = ordered - totalCancelledQty;
  const fullyWithdrawn = storedCancelledQuantity === null;
  const keepLineActiveForSales =
    !fullyWithdrawn &&
    statusAfter !== "Anulowane" &&
    (activeAfter > delivered || (delivered > 0 && statusAfter === "Zrealizowane"));

  return {
    cancelQty,
    totalCancelledQty,
    storedCancelledQuantity,
    statusAfter,
    keepLineActiveForSales,
  };
}

function salesPartialCancelRemainingAfterDelivery(activeAfter: number): string {
  if (activeAfter === 1) {
    return "Pozostała 1 szt. będzie na Ciebie czekała po dostawie.";
  }
  return `Pozostałe ${activeAfter} szt. będą na Ciebie czekały po dostawie.`;
}

export function salesPartialCancelConfirmCopy(
  phase: SalesCancelPhase,
  product: string,
  cancelQty: number,
  maxQty: number,
  deliveredQty = 0
): { title: string; message: string; confirmLabel: string } {
  const base = salesCancelConfirmCopy(phase, { productName: product });
  const qtyPart =
    cancelQty >= maxQty
      ? `${cancelQty} szt.`
      : `${cancelQty} z ${maxQty} szt.`;
  const activeAfter = Math.max(0, deliveredQty + maxQty - cancelQty);
  if (phase === "before_order") {
    if (cancelQty >= maxQty) return base;
    return {
      title: "Wycofać część pozycji?",
      message: `Wycofasz ${qtyPart} pozycji „${product}”. Reszta zostaje w prośbie. ${SALES_CANCEL_UNDO_HINT}`,
      confirmLabel: "Zmień ilość",
    };
  }
  if (phase === "in_transit" && cancelQty < maxQty && activeAfter > 0) {
    return {
      title: "Zmniejszyć ilość w zamówieniu?",
      message: `Wycofasz ${qtyPart} z pozycji „${product}”. ${salesPartialCancelRemainingAfterDelivery(activeAfter)}`,
      confirmLabel: "Zmień ilość",
    };
  }
  if (cancelQty < maxQty) {
    return {
      title: "Zmienić ilość w prośbie?",
      message: `Wycofasz ${qtyPart} z pozycji „${product}”. Reszta zostaje w prośbie. ${SALES_CANCEL_UNDO_HINT}`,
      confirmLabel: "Zmień ilość",
    };
  }
  return {
    title: base.title,
    message: base.message,
    confirmLabel: base.confirmLabel,
  };
}

/** Pełna ilość rezygnacji do przyjęcia (łącznie), gdy zakupy wydały decyzję. */
export function receiveQueueCancelDispositionTotal(order: IndividualOrder): number | null {
  if (
    !order.sales_cancelled_at ||
    !order.procurement_cancel_disposition ||
    !isSalesCancelledForQueue(order) ||
    order.warehouse_cancel_fulfilled_at
  ) {
    return null;
  }
  const cancelled = effectiveSalesCancelledQuantity(order);
  return cancelled > 0 ? cancelled : null;
}

/** Ilość docelowa w kolejce dostaw (aktywne zamówienie lub pełna rezygnacja). */
export function receiveQueueTargetQuantity(order: IndividualOrder): number | null {
  const cancelTotal = receiveQueueCancelDispositionTotal(order);
  if (cancelTotal != null) return cancelTotal;
  const progress = fulfillmentProgressFor(order);
  return progress.activeOrdered ?? progress.ordered;
}

/** Brakująca ilość do przyjęcia (rezygnacja w drodze po częściowym przyjęciu). */
export function receiveQueueRemainingQuantity(order: IndividualOrder): number | null {
  const cancelTotal = receiveQueueCancelDispositionTotal(order);
  if (cancelTotal == null) return null;
  if (effectiveSalesCancelPhase(order) !== "in_transit") return null;
  const delivered = deliveryProgressFor(order).delivered;
  const remaining = Math.max(0, cancelTotal - delivered);
  return remaining > 0 ? remaining : 0;
}

/** Czy u dostawcy zostaje jeszcze coś do śledzenia. */
export function hasActiveSupplierFulfillment(order: IndividualOrder): boolean {
  if (isInformacjaRequest(order)) return false;
  const remaining = fulfillmentProgressFor(order).supplierRemaining;
  return remaining != null && remaining > 0;
}

/** Odbiór z magazynu po częściowej rezygnacji (np. 2/5 — rezygnacja z reszty). */
export function isPendingSalesPickupAfterPartialCancel(order: IndividualOrder): boolean {
  if (isInformacjaRequest(order)) return false;
  if (order.status !== "Zrealizowane" || order.sales_acknowledged_at) return false;
  if (!order.sales_cancelled_at) return false;
  const cancelled = effectiveSalesCancelledQuantity(order);
  if (cancelled <= 0) return false;
  const delivered = deliveryProgressFor(order).delivered;
  const active = activeOrderQuantity(order);
  return delivered > 0 && active != null && delivered >= active;
}

/** Pozostała ilość do wycofania (bez rekurencji z resolveSalesCancelPhase). */
function remainingCancelQuantity(order: IndividualOrder): number {
  if (!order.sales_cancelled_at) {
    return maxSalesCancelQuantity(order) ?? 0;
  }
  const storedPhase = effectiveSalesCancelPhase(order);
  if (storedPhase === "on_stock") {
    const active = activeOrderQuantity(order);
    return active ?? 0;
  }
  return maxSupplierCancelQuantity(order);
}

/** Czy handlowiec może wycofać prośbę w tym statusie. */
export function resolveSalesCancelPhase(
  order: IndividualOrder
): SalesCancelPhase | null {
  if (order.sales_acknowledged_at) return null;

  const { status } = order;
  if (status === "Anulowane") return null;

  if (order.sales_cancelled_at) {
    if (remainingCancelQuantity(order) <= 0) return null;
  }

  /** Prośba informacyjna — zawsze proste wycofanie (bez kolejki realizacji). */
  if (isInformacjaRequest(order)) {
    if (status === "Nowe" || status === "Weryfikacja" || status === "Zrealizowane") {
      return "before_order";
    }
    return null;
  }

  if (status === "Nowe" || status === "Weryfikacja") {
    return "before_order";
  }

  if (status === "Zamowione") {
    return "in_transit";
  }

  if (status === "Czesciowo_zrealizowane") {
    const progress = deliveryProgressFor(order);
    if (progress.delivered > 0) return "on_stock";
    return "in_transit";
  }

  if (status === "Zrealizowane") {
    const active = activeOrderQuantity(order);
    if (active == null || active <= 0) return null;
    return "on_stock";
  }

  return null;
}

export function canSalesCancelOrders(orders: IndividualOrder[]): boolean {
  const open = orders.filter((o) => !o.sales_acknowledged_at);
  if (!open.length) return false;
  return open.some((o) => resolveSalesCancelPhase(o) !== null);
}

export function isSalesCancelNoticePending(order: IndividualOrder): boolean {
  if (!order.sales_cancelled_at || order.sales_acknowledged_at) return false;
  if (isPendingSalesPickupAfterPartialCancel(order)) return false;
  if (hasActiveSupplierFulfillment(order) && order.status !== "Anulowane") {
    return false;
  }
  const phase = effectiveSalesCancelPhase(order);
  return phase === "in_transit" || phase === "on_stock";
}

/**
 * Po rezygnacji z modala handlowiec nie powinien widzieć drugiego kroku
 * „potwierdź informację o rezygnacji” — ukryj od razu (archiwum).
 */
export function mergeSalesCancelUserAutoAck(
  update: Record<string, unknown>,
  orderBefore: IndividualOrder,
  caps: { hasCancelledAt: boolean },
  now: string
): void {
  if (update.sales_acknowledged_at || !caps.hasCancelledAt) return;
  const simulated = {
    ...orderBefore,
    ...update,
  } as IndividualOrder;
  if (isSalesCancelNoticePending(simulated)) {
    update.sales_acknowledged_at = now;
  }
}

/** Najostrzejsza faza w grupie (do komunikatu potwierdzenia). */
export function resolveGroupSalesCancelPhase(
  orders: IndividualOrder[]
): SalesCancelPhase | null {
  const phases = orders
    .map(resolveSalesCancelPhase)
    .filter((p): p is SalesCancelPhase => p !== null);
  if (!phases.length) return null;
  if (phases.includes("on_stock")) return "on_stock";
  if (phases.includes("in_transit")) return "in_transit";
  return "before_order";
}

export type SalesCancelConfirmContext = {
  /** Jedna pozycja — nazwa produktu w treści dialogu. */
  productName?: string | null;
  /** Wiele pozycji — lista nazw (menu „anuluj wszystkie”). */
  productNames?: string[];
};

export type SalesCancelLineContext = {
  product: string;
  phase: SalesCancelPhase;
};

function formatProductList(names: string[]): string {
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (!trimmed.length) return "";
  if (trimmed.length === 1) return `„${trimmed[0]}”`;
  if (trimmed.length === 2) return `„${trimmed[0]}” i „${trimmed[1]}”`;
  if (trimmed.length === 3) {
    return `„${trimmed[0]}”, „${trimmed[1]}” i „${trimmed[2]}”`;
  }
  return `„${trimmed[0]}”, „${trimmed[1]}” i jeszcze ${trimmed.length - 2}`;
}

function isSingleLineCancel(context?: SalesCancelConfirmContext): boolean {
  return Boolean(context?.productName?.trim()) && !context?.productNames?.length;
}

export function salesCancelOverflowLabel(
  kind: "zamowienie" | "informacja",
  cancellableCount: number
): string {
  const base = kind === "informacja" ? "Anuluj informację" : "Anuluj prośbę";
  if (cancellableCount <= 1) return base;
  const n = cancellableCount;
  const pozycja = n === 1 ? "pozycję" : n < 5 ? "pozycje" : "pozycji";
  return `Anuluj wszystkie pozycje (${n} ${pozycja})`;
}

export function salesCancelLineLabel(kind: "zamowienie" | "informacja"): string {
  return kind === "informacja" ? "Anuluj informację" : "Anuluj pozycję";
}

/** Krótka etykieta przy linii produktu — pełne wycofanie pozycji. */
export function salesCancelLineShortLabel(kind: "zamowienie" | "informacja"): string {
  return kind === "informacja" ? "Anuluj" : "Anuluj";
}

/** Pełne anulowanie w menu overflow (jedna pozycja w prośbie). */
export function salesCancelSoleOverflowFullLabel(kind: "zamowienie" | "informacja"): string {
  if (kind === "informacja") return "Anuluj informację";
  return "Anuluj prośbę";
}

export function salesCancelLineAriaLabel(
  kind: "zamowienie" | "informacja",
  product: string
): string {
  return `${salesCancelLineLabel(kind)}: ${product}`;
}

/** Dialog potwierdzenia — jedna lub wiele pozycji, z obsługą mieszanych faz. */
export function salesCancelConfirmForLines(lines: SalesCancelLineContext[]): {
  title: string;
  message: string;
  confirmLabel: string;
} {
  const valid = lines.filter((l) => l.product.trim() && l.phase);
  if (!valid.length) {
    return salesCancelConfirmCopy("before_order");
  }
  if (valid.length === 1) {
    return salesCancelConfirmCopy(valid[0]!.phase, { productName: valid[0]!.product });
  }
  const phases = new Set(valid.map((l) => l.phase));
  if (phases.size === 1) {
    return salesCancelConfirmCopy(valid[0]!.phase, {
      productNames: valid.map((l) => l.product),
    });
  }
  const products = formatProductList(valid.map((l) => l.product));
  return {
    title: "Wycofać wybrane pozycje?",
    message: `Pozycje ${products} zostaną wycofane — skutek zależy od etapu każdej z nich (część może być już u dostawcy lub na magazynie). ${SALES_CANCEL_UNDO_HINT}`,
    confirmLabel: "Wycofaj wybrane",
  };
}

export function salesCancelConfirmCopy(
  phase: SalesCancelPhase,
  context?: SalesCancelConfirmContext
): {
  title: string;
  message: string;
  confirmLabel: string;
} {
  const single = isSingleLineCancel(context);
  const product = context?.productName?.trim();
  const groupProducts = context?.productNames?.length
    ? formatProductList(context.productNames)
    : "";

  switch (phase) {
    case "before_order":
      if (single && product) {
        return {
          title: "Wycofać tę pozycję?",
          message: `„${product}” zniknie z Twojej listy i u działu dostaw. ${SALES_CANCEL_UNDO_HINT}`,
          confirmLabel: "Wycofaj pozycję",
        };
      }
      return {
        title: groupProducts ? "Wycofać wszystkie pozycje?" : "Wycofać prośbę?",
        message: groupProducts
          ? `Pozycje ${groupProducts} znikną z Twojej listy i u działu dostaw. ${SALES_CANCEL_UNDO_HINT}`
          : `Prośba zniknie z Twojej listy i u działu dostaw. ${SALES_CANCEL_UNDO_HINT}`,
        confirmLabel: groupProducts ? "Wycofaj wszystkie" : "Wycofaj prośbę",
      };
    case "in_transit":
      if (single && product) {
        return {
          title: "Anulować tę pozycję?",
          message: `„${product}” może być już u dostawcy. Jeśli towar dotrze, magazyn rozliczy go poza Twoją rezerwacją.`,
          confirmLabel: "Anuluj pozycję",
        };
      }
      return {
        title: groupProducts ? "Anulować wszystkie pozycje?" : "Anulować prośbę?",
        message: groupProducts
          ? `Pozycje ${groupProducts} mogą być już u dostawcy. Jeśli towar dotrze, magazyn rozliczy go poza Twoją rezerwacją.`
          : "Zamówienie może być już u dostawcy. Jeśli towar dotrze, magazyn rozliczy go poza Twoją rezerwacją.",
        confirmLabel: groupProducts ? "Anuluj wszystkie" : "Anuluj prośbę",
      };
    case "on_stock":
      if (single && product) {
        return {
          title: "Anulować tę pozycję?",
          message: `„${product}” może być już na magazynie. Magazyn rozliczy towar poza Twoją rezerwacją.`,
          confirmLabel: "Anuluj pozycję",
        };
      }
      return {
        title: groupProducts ? "Anulować wszystkie pozycje?" : "Anulować prośbę?",
        message: groupProducts
          ? `Pozycje ${groupProducts} mogą być już na magazynie. Magazyn rozliczy towar poza Twoją rezerwacją.`
          : "Część lub całość może być już na magazynie. Magazyn rozliczy towar poza Twoją rezerwacją.",
        confirmLabel: groupProducts ? "Anuluj wszystkie" : "Anuluj prośbę",
      };
  }
}

export function isSalesCancelledForQueue(order: IndividualOrder): boolean {
  if (!order.sales_cancelled_at) return false;
  if (hasActiveSupplierFulfillment(order)) return false;
  const phase = effectiveSalesCancelPhase(order);
  return phase === "in_transit" || phase === "on_stock";
}

/** Toast po wycofaniu prośby przez handlowca. */
export function salesCancelSuccessToast(lineCount = 1): string {
  if (lineCount === 1) {
    return "Pozycja wycofana. Szczegóły znajdziesz w sekcji „Ostatnio zakończone” poniżej.";
  }
  return `${lineCount} poz. wycofane. Szczegóły znajdziesz w sekcji „Ostatnio zakończone” poniżej.`;
}

/** Opis w archiwum dla wycofanych pozycji (wg fazy rezygnacji). */
export function salesCancelArchiveDetail(
  phase: SalesCancelPhase,
  activityLabel: string | null,
  partial?: { cancelledQty: number; orderedQty: number } | null
): { statusTitle: string; statusDetail: string } {
  const when = activityLabel ? `Wycofano ${activityLabel}.` : "Wycofano.";
  const partialNote =
    partial && partial.cancelledQty > 0 && partial.cancelledQty < partial.orderedQty
      ? ` Rezygnacja z ${partial.cancelledQty} z ${partial.orderedQty} szt.`
      : "";

  switch (phase) {
    case "in_transit":
      return {
        statusTitle: "Rezygnacja — towar w drodze",
        statusDetail: `${when}${partialNote} Jeśli towar dotrze, magazyn rozliczy go w zakładce Przyjęcie towaru.`,
      };
    case "on_stock":
      return {
        statusTitle: "Rezygnacja — towar na magazynie",
        statusDetail: `${when}${partialNote} Magazyn rozliczy towar w zakładce Przyjęcie towaru (stan lub zwrot).`,
      };
    default:
      return {
        statusTitle: partialNote.trim() ? "Częściowo wycofane" : "Anulowane",
        statusDetail: partialNote.trim()
          ? `${when}${partialNote}`
          : activityLabel
            ? `Wycofano ${activityLabel}`
            : "Prośba wycofana",
      };
  }
}

export function salesCancelQueueBanner(order: IndividualOrder): string {
  const person = order.sales_person?.name ?? "handlowiec";
  const disposition = order.procurement_cancel_disposition;
  const note = order.procurement_cancel_disposition_note?.trim();

  if (disposition === "to_stock") {
    return note
      ? `Rezygnacja ${person} — na stan magazynu — ${note}`
      : `Rezygnacja ${person} — na stan magazynu, poza rezerwacją handlowca.`;
  }
  if (disposition === "return") {
    return note
      ? `Rezygnacja ${person} — zwrot do dostawcy — ${note}`
      : `Rezygnacja ${person} — zwrot do dostawcy.`;
  }

  const phase =
    effectiveSalesCancelPhase(order) ??
    resolveSalesCancelPhase(order) ??
    "in_transit";

  if (phase === "on_stock") {
    return `Rezygnacja ${person} — wybierz: na stan magazynu lub zwrot do dostawcy.`;
  }
  return `Rezygnacja ${person} — towar może jeszcze dotrzeć. Po dostawie wybierz: na stan albo zwrot.`;
}
