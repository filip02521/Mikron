import {
  getDeliveryProgress,
  isInformacjaRequest,
  type DeliveryProgress,
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

/** Czy handlowiec może wycofać prośbę w tym statusie. */
export function resolveSalesCancelPhase(
  order: IndividualOrder
): SalesCancelPhase | null {
  if (order.sales_cancelled_at) return null;

  const { status } = order;
  if (status === "Anulowane") return null;

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
    return "on_stock";
  }

  return null;
}

export function canSalesCancelOrders(orders: IndividualOrder[]): boolean {
  const open = orders.filter(
    (o) => !o.sales_acknowledged_at && !o.sales_cancelled_at
  );
  if (!open.length) return false;
  return open.every((o) => resolveSalesCancelPhase(o) !== null);
}

export function isSalesCancelNoticePending(order: IndividualOrder): boolean {
  if (!order.sales_cancelled_at || order.sales_acknowledged_at) return false;
  const phase = effectiveSalesCancelPhase(order);
  return phase === "in_transit" || phase === "on_stock";
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

/** Krótka etykieta przy linii produktu — dyskretny link po prawej. */
export function salesCancelLineShortLabel(_kind: "zamowienie" | "informacja"): string {
  return "Anuluj";
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
          title: "Rezygnujesz z tej pozycji?",
          message: `„${product}” może być już u dostawcy. Jeśli towar dotrze, magazyn rozliczy go poza Twoją rezerwacją.`,
          confirmLabel: "Rezygnuję z pozycji",
        };
      }
      return {
        title: "Rezygnujesz z zamówienia?",
        message: groupProducts
          ? `Pozycje ${groupProducts} mogą być już u dostawcy. Jeśli towar dotrze, magazyn rozliczy go poza Twoją rezerwacją.`
          : "Zamówienie może być już u dostawcy. Jeśli towar dotrze, magazyn rozliczy go poza Twoją rezerwacją.",
        confirmLabel: "Rezygnuję",
      };
    case "on_stock":
      if (single && product) {
        return {
          title: "Rezygnujesz z tej pozycji?",
          message: `„${product}” może być już na magazynie. Magazyn rozliczy towar poza Twoją rezerwacją.`,
          confirmLabel: "Rezygnuję z pozycji",
        };
      }
      return {
        title: "Rezygnujesz z towaru?",
        message: groupProducts
          ? `Pozycje ${groupProducts} mogą być już na magazynie. Magazyn rozliczy towar poza Twoją rezerwacją.`
          : "Część lub całość może być już na magazynie. Magazyn rozliczy towar poza Twoją rezerwacją.",
        confirmLabel: "Rezygnuję",
      };
  }
}

export function isSalesCancelledForQueue(order: IndividualOrder): boolean {
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
  activityLabel: string | null
): { statusTitle: string; statusDetail: string } {
  const when = activityLabel ? `Wycofano ${activityLabel}.` : "Wycofano.";

  switch (phase) {
    case "in_transit":
      return {
        statusTitle: "Rezygnacja — towar w drodze",
        statusDetail: `${when} Jeśli towar dotrze, magazyn rozliczy go w zakładce Magazyn i regał.`,
      };
    case "on_stock":
      return {
        statusTitle: "Rezygnacja — towar na magazynie",
        statusDetail: `${when} Magazyn rozliczy towar w zakładce Magazyn i regał (stan lub zwrot).`,
      };
    default:
      return {
        statusTitle: "Anulowane",
        statusDetail: activityLabel ? `Wycofano ${activityLabel}` : "Prośba wycofana",
      };
  }
}

export function salesCancelQueueBanner(order: IndividualOrder): string {
  const person = order.sales_person?.name ?? "handlowiec";
  const disposition = order.procurement_cancel_disposition;
  const note = order.procurement_cancel_disposition_note?.trim();

  if (disposition === "to_stock") {
    return note
      ? `Rozliczono: na stan magazynu (${person}) — ${note}`
      : `Rozliczono: na stan magazynu (${person}), poza rezerwacją handlowca.`;
  }
  if (disposition === "return") {
    return note
      ? `Rozliczono: zwrot do dostawcy (${person}) — ${note}`
      : `Rozliczono: przygotować zwrot do dostawcy (${person}).`;
  }

  const phase =
    effectiveSalesCancelPhase(order) ??
    resolveSalesCancelPhase(order) ??
    "in_transit";

  if (phase === "on_stock") {
    return `Rezygnacja ${person} — wybierz: na stan magazynu lub zwrot do dostawcy.`;
  }
  return `Rezygnacja ${person} — towar może jeszcze przyjechać. Po dostawie rozlicz na stan lub zwrot.`;
}
