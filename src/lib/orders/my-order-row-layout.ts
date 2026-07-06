import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { isInformacjaAvailabilityPendingStatusTitle } from "@/lib/orders/informacja-flow-copy";
import {
  linesWithoutZdTerm,
  zdFulfillmentHasMultipleSlots,
  zdFulfillmentSlots,
} from "@/lib/orders/my-order-zd-fulfillment-display";
import {
  shouldShowOrderStatusDetail,
} from "@/lib/orders/my-order-card-ui";
import {
  myOrderMetaFields,
  isProsbaHandoffStatus,
  isExpandedSublineRedundant,
  parseStatusDetailMetaParts,
  verificationSublineFromDetail,
} from "@/lib/orders/my-order-sales-ui";

export type MyOrderListKind = "zamowienie" | "informacja";

/** Krótka wskazówka pod nagłówkiem — tylko to, co potrzebne bez rozwijania. */
export function myOrderCollapsedSubline(row: MyOrderRow): string | null {
  if (
    row.acknowledgeMode === "pickup" ||
    row.acknowledgeMode === "availability" ||
    row.acknowledgeMode === "cancel_notice" ||
    row.acknowledgeMode === "cancelled"
  ) {
    return row.subline ?? null;
  }

  if (isProsbaHandoffStatus(row.statusTitle)) {
    return verificationSublineFromDetail(row.statusDetail);
  }

  if (row.statusTitle === "Częściowo na magazynie" && row.subline?.trim()) {
    const product = myOrderProductPreviewLine(row);
    return product ? `${product} · ${row.subline}` : row.subline;
  }

  if (row.headlineTone === "warning") {
    if (row.subline?.trim()) return row.subline;
    if (row.timingLabel?.trim()) {
      const product = myOrderProductPreviewLine(row);
      if (product) return product;
      return row.timingLabel.replace(" · po terminie", "").trim();
    }
    return null;
  }

  if (row.headlineTone === "info" && row.statusTitle === "Zamówione") {
    if (row.subline?.trim()) return row.subline;
    if (row.timingLabel?.trim()) {
      const product = myOrderProductPreviewLine(row);
      if (product) return product;
      return row.timingLabel.replace(" · po terminie", "").trim();
    }
  }

  if (
    row.headlineTone === "info" &&
    row.statusTitle !== "Zamówione" &&
    !isInformacjaFlowSublineExpandedOnly(row.statusTitle) &&
    row.subline?.trim()
  ) {
    return row.subline;
  }

  return null;
}

/** Statusy informacyjne, których subline ma się pojawić dopiero po rozwinięciu jako badge — nie w zwiniętej karcie. */
function isInformacjaFlowSublineExpandedOnly(statusTitle: string): boolean {
  return (
    statusTitle === "Czekamy na zamówienie u dostawcy" ||
    statusTitle === "Zamówione — czekamy na magazyn" ||
    isInformacjaAvailabilityPendingStatusTitle(statusTitle)
  );
}

/** Dłuższe wyjaśnienia — wyłącznie w rozwinięciu. */
export function myOrderExpandedNotes(row: MyOrderRow): string | null {
  const parts: string[] = [];
  const collapsed = myOrderCollapsedSubline(row);

  if (shouldShowOrderStatusDetail(row) && row.statusDetail?.trim()) {
    const { remainder } = parseStatusDetailMetaParts(row.statusDetail);
    if (remainder) parts.push(remainder);
  }

  if (row.subline?.trim() && row.subline !== collapsed && !isExpandedSublineRedundant(row)) {
    const explanatory =
      row.statusTitle === "Przed zamówieniem" ||
      isInformacjaAvailabilityPendingStatusTitle(row.statusTitle) ||
      row.statusTitle === "Czekamy na zamówienie u dostawcy" ||
      row.statusTitle === "Zamówione — czekamy na magazyn" ||
      row.statusTitle === "Zamówione" ||
      isProsbaHandoffStatus(row.statusTitle) ||
      row.kind === "informacja";
    if (explanatory) parts.push(row.subline.trim());
  }

  return parts.length ? parts.join(" ") : null;
}

/** Metadane na zwiniętym wierszu — bez nadmiaru. */
export function myOrderCollapsedMetaFields(
  row: MyOrderRow,
  showProgress: boolean
): { label: string; value: string; emphasize?: boolean }[] {
  const all = myOrderMetaFields(row, showProgress);
  const pick = new Set<string>();

  pick.add("Zgłoszono");

  if (row.clientLabel && row.lineCount <= 1) pick.add("Klient");

  if (
    showProgress &&
    (row.acknowledgeMode === "pickup" ||
      row.statusTitle.includes("magazynie") ||
      row.statusTitle === "Częściowo na magazynie")
  ) {
    pick.add("Magazyn");
  }

  const filtered = all.filter((f) => pick.has(f.label));
  if (filtered.length >= 2) return filtered;

  return filtered.length ? filtered : all.slice(0, 2);
}

export function myOrderProductPreviewLine(row: MyOrderRow): string {
  if (row.lineCount <= 1) {
    return row.lines[0]?.product ?? row.product;
  }
  return row.lines[0]?.product ?? row.product;
}

export type MyOrderExpandContext = {
  listKind: MyOrderListKind;
  showGroupPickup: boolean;
};

/** Każda prośba z pozycjami jest zwijana — lista towaru dopiero po rozwinięciu. */
export function myOrderNeedsExpand(row: MyOrderRow, ctx: MyOrderExpandContext): boolean {
  if (row.lineCount > 0) return true;
  if (myOrderExpandedNotes(row)) return true;
  if (ctx.showGroupPickup) return true;
  return false;
}

/** @deprecated Lista produktów tylko w panelu rozwinięcia — zawsze skrót na wierszu. */
export function myOrderCollapsedProductMode(
  _row: MyOrderRow,
  _listKind: MyOrderListKind
): "full" | "summary" {
  void _row;
  void _listKind;
  return "summary";
}

/** Krótki opis liczby pozycji na zwiniętym wierszu (bez nazw towaru). */
export function myOrderCollapsedProductSummary(
  row: MyOrderRow,
  listKind: MyOrderListKind
): string {
  const n = row.lineCount;
  if (n <= 0) return "";
  if (listKind === "informacja") {
    return n === 1 ? "1 pozycja" : `${n} ${pluralPozycje(n)}`;
  }
  return n === 1 ? "1 produkt" : `${n} ${pluralProdukty(n)}`;
}

function pluralPozycje(n: number): string {
  if (n === 1) return "pozycję";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "pozycje";
  return "pozycji";
}

function pluralProdukty(n: number): string {
  if (n === 1) return "produkt";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "produkty";
  return "produktów";
}

/** Tekst zachęty przy zwiniętym wierszu z chevronem. */
export function myOrderExpandHint(row: MyOrderRow, ctx: MyOrderExpandContext): string {
  if (
    row.zdFulfillment &&
    zdFulfillmentHasMultipleSlots(row.zdFulfillment)
  ) {
    const n = zdFulfillmentSlots(row.zdFulfillment).length;
    return n === 2 ? "Rozwiń po oba terminy" : `Rozwiń po ${n} terminy`;
  }
  const withoutZd = linesWithoutZdTerm(row.lines);
  if (row.zdFulfillment && withoutZd.length) {
    return withoutZd.length === 1
      ? "Rozwiń po wszystkie terminy"
      : "Rozwiń po terminy pozycji";
  }
  const n = row.lineCount;
  if (ctx.listKind === "zamowienie" && n >= 2) {
    return `Rozwiń ${n} ${pluralProdukty(n)}`;
  }
  if (ctx.listKind === "informacja" && n >= 2) {
    return `Rozwiń ${n} ${pluralPozycje(n)}`;
  }
  if (myOrderExpandedNotes(row)) {
    return row.kind === "informacja" ? "Rozwiń wyjaśnienie" : "Rozwiń wyjaśnienie statusu";
  }
  return ctx.listKind === "informacja" ? "Rozwiń pozycję" : "Rozwiń produkt";
}
