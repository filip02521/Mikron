import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { hasAnyProductHint } from "@/lib/orders/request-completeness";
import { planSalesRequestSubmit } from "@/lib/orders/sales-request-submit";
import { prosbaLineHasTeethBlockers } from "@/lib/orders/prosba-line-field-validation";
import { lineLooksLikeTeethProduct } from "@/lib/orders/teeth-stock-exempt";
import { teethLineDetailsComplete } from "@/lib/teeth/teeth-validation";
import type { IndividualRequestKind } from "@/types/database";

/** Pozycja gotowa pod względem produktu/ilości (Subiekt lub komplet ręczny) — bez listy zębów. */
export function isProsbaLineReady(
  line: ProductLineDraft,
  requestKind: IndividualRequestKind
): boolean {
  if (!hasAnyProductHint(line)) return false;
  return planSalesRequestSubmit({
    symbol: line.symbol,
    mikranCode: line.mikranCode,
    product: line.product,
    quantity: line.quantity,
    requestKind,
    subiektTwId: line.subiektTwId,
  }).submittable;
}

export type ProsbaCollapseOptions = {
  exemptTwIds?: ReadonlySet<number>;
  /** false = katalog zębów niedostępny — nie zwijaj linii wyglądających na zębowe. */
  catalogAvailable?: boolean;
};

/**
 * Czy pozycję można zwinąć w trybie podsumowania:
 * gotowa do wysłania (produkt+qty) oraz bez blockerów listy zębów.
 */
export function canCollapseProsbaLine(
  line: ProductLineDraft,
  requestKind: IndividualRequestKind,
  options?: ProsbaCollapseOptions,
): boolean {
  if (!isProsbaLineReady(line, requestKind)) return false;

  if (
    options?.catalogAvailable === false &&
    lineLooksLikeTeethProduct(line, options.exemptTwIds)
  ) {
    return false;
  }

  if (
    prosbaLineHasTeethBlockers(line, requestKind, {
      exemptTwIds: options?.exemptTwIds,
    })
  ) {
    return false;
  }

  // Prefill/pick mógł ustawić producenta zanim rejestr (exempt) się załaduje —
  // nie zwijaj szkicu wyłącznie dlatego, że twId nie jest jeszcze w exempt.
  if (requestKind === "zamowienie" && line.teethManufacturer) {
    const listComplete = teethLineDetailsComplete({
      teethDetails: line.teethDetails,
      quantity: line.quantity,
      product: line.product,
      subiektTwId: line.subiektTwId,
      adminProductLine: line.teethProductLine,
      adminManufacturer: line.teethManufacturer,
      isTeethProduct: true,
    });
    if (!listComplete) return false;
  }

  return true;
}

export function isProsbaLineFromSubiekt(line: ProductLineDraft): boolean {
  const id = line.subiektTwId;
  return id != null && id > 0;
}

export type ProsbaLineSummary = {
  title: string;
  meta: string | null;
  quantityLabel: string | null;
  fromSubiekt: boolean;
  clientName: string | null;
};

/** Skrót do zwiniętej pozycji na liście prośby. */
export function formatProsbaLineSummary(
  line: ProductLineDraft,
  requestKind: IndividualRequestKind
): ProsbaLineSummary {
  const fromSubiekt = isProsbaLineFromSubiekt(line);
  const product = line.product.trim();
  const symbol = line.symbol.trim();
  const kod = line.mikranCode.trim();
  const title = product || symbol || kod || "Produkt";

  const metaParts: string[] = [];
  if (product && symbol) metaParts.push(symbol);
  else if (symbol && symbol !== title) metaParts.push(symbol);
  if (kod) metaParts.push(`Kod ${kod}`);
  if (fromSubiekt) metaParts.push("Subiekt");

  const qty = line.quantity.trim();
  const quantityLabel =
    requestKind === "informacja"
      ? null
      : qty
        ? `${qty} szt.`
        : null;

  return {
    title,
    meta: metaParts.length ? metaParts.join(" · ") : null,
    quantityLabel,
    fromSubiekt,
    clientName: line.clientName?.trim() || null,
  };
}

/** Czy w trybie prośby pokazać zwinięty wiersz zamiast pełnego formularza. */
export function shouldCollapseProsbaLine(
  line: ProductLineDraft,
  requestKind: IndividualRequestKind,
  lineCount: number,
  activeLineId: string,
  options?: ProsbaCollapseOptions,
): boolean {
  if (line.id === activeLineId) return false;
  if (!canCollapseProsbaLine(line, requestKind, options)) return false;
  // Jedyna pozycja: zwijaj tylko w trybie przeglądu (brak aktywnej linii).
  if (lineCount <= 1) return !activeLineId;
  return true;
}

/**
 * Po zapisie listy zębów — zwijamy uzupełnione pozycje; zostawiamy rozwiniętą pierwszą niekompletną.
 * Gdy wszystkie (poza zapisanymi) są collapsible → `null` (tryb podsumowania), także przy 1 linii.
 */
export function focusLineIdAfterTeethSave(
  lines: ProductLineDraft[],
  savedLineIds: Iterable<string>,
  requestKind: IndividualRequestKind,
  options?: ProsbaCollapseOptions,
): string | null {
  const saved = new Set(savedLineIds);
  const nextIncomplete = lines.find(
    (line) =>
      !saved.has(line.id) &&
      !canCollapseProsbaLine(line, requestKind, options),
  );
  if (nextIncomplete) return nextIncomplete.id;
  return null;
}
