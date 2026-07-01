import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { hasAnyProductHint } from "@/lib/orders/request-completeness";
import { planSalesRequestSubmit } from "@/lib/orders/sales-request-submit";
import type { IndividualRequestKind } from "@/types/database";

/** Pozycja gotowa do wysłania (Subiekt lub komplet ręczny). */
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
): boolean {
  if (lineCount <= 1) return false;
  if (!activeLineId) return isProsbaLineReady(line, requestKind);
  if (line.id === activeLineId) return false;
  return isProsbaLineReady(line, requestKind);
}

/** Po zapisie listy zębów — zwijamy uzupełnione pozycje; zostawiamy rozwiniętą pierwszą niegotową. */
export function focusLineIdAfterTeethSave(
  lines: ProductLineDraft[],
  savedLineIds: Iterable<string>,
  requestKind: IndividualRequestKind,
): string | null {
  const saved = new Set(savedLineIds);
  const nextIncomplete = lines.find(
    (line) => !saved.has(line.id) && !isProsbaLineReady(line, requestKind),
  );
  if (nextIncomplete) return nextIncomplete.id;
  return lines.length > 1 ? null : lines[0]?.id ?? null;
}
