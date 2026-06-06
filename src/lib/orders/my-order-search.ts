import type { MyOrderLine, MyOrderRow } from "@/lib/orders/my-order-presenter";
import { myOrderFriendlyStatusLabel } from "@/lib/orders/my-order-friendly-status";
import type { MojeClientLinkFilter } from "@/lib/orders/moje-client-link-filter";
import {
  filterMyOrderRowsByClientLink,
  rowMatchesMojeClientLinkFilter,
} from "@/lib/orders/moje-client-link-filter";

export type { MojeClientLinkFilter };
export { filterMyOrderRowsByClientLink, rowMatchesMojeClientLinkFilter };

const POLISH_FOLD_MAP: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
};

/** Porównywanie bez polskich znaków diakrytycznych. */
export function normalizeMyOrderSearchText(raw: string): string {
  let s = raw.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[ąćęłńóśźż]/g, (ch) => POLISH_FOLD_MAP[ch] ?? ch);
  return s;
}

export function searchQueryTokens(query: string | null | undefined): string[] {
  const normalized = normalizeMyOrderSearchText(query ?? "");
  if (!normalized) return [];
  return normalized.split(/\s+/).filter(Boolean);
}

/** Tekst do przeszukania dla jednej prośby / grupy. */
export function myOrderRowSearchText(row: MyOrderRow): string {
  const chunks: string[] = [
    row.supplierName,
    row.product,
    row.symbol ?? "",
    row.clientLabel ?? "",
    row.sourceZkNumber ?? "",
    row.statusTitle,
    myOrderFriendlyStatusLabel(row.statusTitle),
    row.statusDetail ?? "",
    row.timingLabel ?? "",
    row.headline ?? "",
    row.submittedLabel,
  ];

  for (const line of row.lines) {
    chunks.push(
      line.product,
      line.symbol ?? "",
      line.clientName ?? "",
      line.mikranCode ?? "",
      line.quantityLabel
    );
  }

  return normalizeMyOrderSearchText(chunks.filter(Boolean).join("\n"));
}

/** Tekst jednej pozycji produktowej (bez nagłówka grupy). */
export function myOrderLineSearchText(line: MyOrderLine): string {
  return normalizeMyOrderSearchText(
    [line.product, line.symbol ?? "", line.clientName ?? "", line.mikranCode ?? "", line.quantityLabel]
      .filter(Boolean)
      .join("\n")
  );
}

function myOrderProductHeaderSearchText(row: MyOrderRow): string {
  return normalizeMyOrderSearchText(
    [row.product, row.symbol ?? ""].filter(Boolean).join("\n")
  );
}

/** Czy zapytanie trafia w nagłówek towaru (nie tylko dostawca / status). */
export function rowSearchMatchesProductHeader(
  row: MyOrderRow,
  query: string | null | undefined
): boolean {
  const tokens = searchQueryTokens(query);
  if (!tokens.length) return false;
  const haystack = myOrderProductHeaderSearchText(row);
  return tokens.some((token) => haystack.includes(token));
}

/** Czy zapytanie trafia w którąkolwiek pozycję na liście produktów. */
export function rowSearchHighlightsProductLines(
  row: MyOrderRow,
  query: string | null | undefined
): boolean {
  const tokens = searchQueryTokens(query);
  if (!tokens.length || !row.lines.length) return false;
  return row.lines.some((line) => {
    const haystack = myOrderLineSearchText(line);
    return tokens.some((token) => haystack.includes(token));
  });
}

/** Wszystkie tokeny mieszczą się wyłącznie w nazwie dostawcy. */
export function rowSearchMatchesSupplierOnly(
  row: MyOrderRow,
  query: string | null | undefined
): boolean {
  const tokens = searchQueryTokens(query);
  if (!tokens.length) return false;
  const supplierHay = normalizeMyOrderSearchText(row.supplierName);
  return tokens.every((token) => supplierHay.includes(token));
}

export function rowMatchesSearchQuery(
  row: MyOrderRow,
  query: string | null | undefined
): boolean {
  const tokens = searchQueryTokens(query);
  if (!tokens.length) return true;
  const haystack = myOrderRowSearchText(row);
  return tokens.every((token) => haystack.includes(token));
}

/**
 * Rozwiń listę produktów przy wyszukiwaniu — gdy trafienie dotyczy towaru,
 * nie wyłącznie dostawcy / statusu na zwiniętym wierszu.
 */
export function shouldAutoExpandOrderLinesForSearch(
  row: MyOrderRow,
  query: string | null | undefined
): boolean {
  const tokens = searchQueryTokens(query);
  if (!tokens.length || row.lines.length === 0) return false;
  if (rowSearchMatchesSupplierOnly(row, query)) return false;
  if (rowSearchHighlightsProductLines(row, query)) return true;
  if (rowSearchMatchesProductHeader(row, query)) return true;
  if (row.lines.length === 1 && rowMatchesSearchQuery(row, query)) return true;
  return false;
}

/** Filtr po kh_Id klienta (np. z linku z notatnika / ZK). */
export function rowMatchesClientKhFilter(
  row: MyOrderRow,
  khId: number | null | undefined,
  options?: Pick<MojeClientLinkFilter, "clientLabel">
): boolean {
  return rowMatchesMojeClientLinkFilter(row, {
    khId,
    clientLabel: options?.clientLabel,
  });
}

export function filterMyOrderRowsByClientKh(
  rows: MyOrderRow[],
  khId: number | null | undefined,
  options?: Pick<MojeClientLinkFilter, "clientLabel">
): MyOrderRow[] {
  return filterMyOrderRowsByClientLink(rows, {
    khId,
    clientLabel: options?.clientLabel,
  });
}

export function filterMyOrderRowsBySearch(
  rows: MyOrderRow[],
  query: string | null | undefined
): MyOrderRow[] {
  if (!searchQueryTokens(query).length) return rows;
  return rows.filter((row) => rowMatchesSearchQuery(row, query));
}

export function countMyOrderRowsBySearch(
  rows: MyOrderRow[],
  query: string | null | undefined
): number {
  return filterMyOrderRowsBySearch(rows, query).length;
}

/** @deprecated Użyj filterMyOrderRowsBySearch — zachowane dla linków ?klient= */
export const filterMyOrderRowsByClient = filterMyOrderRowsBySearch;
export const rowMatchesClientQuery = rowMatchesSearchQuery;
