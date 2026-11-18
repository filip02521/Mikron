import type { DepartmentBoardThread } from "@/types/database";
import {
  MAX_MIKRAN_CODE_LEN,
  MAX_PRODUCT_TEXT_LEN,
  MAX_SYMBOL_LEN,
} from "@/lib/security/text-limits";

export type BoardQuestionProductDraft = {
  symbol: string;
  product: string;
  subiektTwId: number | null;
  mikranCode: string;
};

export type BoardQuestionProductInput = {
  symbol?: string | null;
  productName?: string | null;
  subiektTwId?: number | null;
  mikranCode?: string | null;
};

export type BoardQuestionProductFields = Pick<
  DepartmentBoardThread,
  "product_symbol" | "product_name" | "subiekt_tw_id" | "mikran_code"
>;

function normalizeBoardQuestionSymbol(symbol?: string | null): string | null {
  const trimmed = symbol?.trim().slice(0, MAX_SYMBOL_LEN) || null;
  if (!trimmed || trimmed === "-") return null;
  return trimmed;
}

export function emptyBoardQuestionProductDraft(): BoardQuestionProductDraft {
  return { symbol: "", product: "", subiektTwId: null, mikranCode: "" };
}

export function boardQuestionDraftHasProduct(draft: BoardQuestionProductDraft): boolean {
  return Boolean(
    draft.product.trim() ||
      (draft.symbol.trim() && draft.symbol.trim() !== "-") ||
      draft.mikranCode.trim() ||
      (typeof draft.subiektTwId === "number" && draft.subiektTwId > 0)
  );
}

export function boardQuestionDraftLinkedToSubiekt(draft: BoardQuestionProductDraft): boolean {
  return typeof draft.subiektTwId === "number" && Number.isFinite(draft.subiektTwId) && draft.subiektTwId > 0;
}

export function boardQuestionHasProduct(
  thread: Partial<BoardQuestionProductFields> | null | undefined
): boolean {
  if (!thread) return false;
  return Boolean(
    normalizeBoardQuestionSymbol(thread.product_symbol) ||
      thread.product_name?.trim() ||
      thread.mikran_code?.trim() ||
      (typeof thread.subiekt_tw_id === "number" && thread.subiekt_tw_id > 0)
  );
}

export function boardQuestionProductLabel(
  thread: Partial<BoardQuestionProductFields>
): string {
  const symbol = normalizeBoardQuestionSymbol(thread.product_symbol);
  const name = thread.product_name?.trim();
  if (symbol && name) return `${symbol} - ${name}`;
  return name || symbol || thread.mikran_code?.trim() || "Produkt";
}

export function boardQuestionProductSearchText(
  thread: Partial<BoardQuestionProductFields>
): string {
  return [
    normalizeBoardQuestionSymbol(thread.product_symbol),
    thread.product_name,
    thread.mikran_code,
    typeof thread.subiekt_tw_id === "number" ? String(thread.subiekt_tw_id) : null,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

export function boardQuestionProductMetaLines(
  thread: Partial<BoardQuestionProductFields>
): string[] {
  const lines: string[] = [];
  const symbol = normalizeBoardQuestionSymbol(thread.product_symbol);
  const mikran = thread.mikran_code?.trim();
  if (symbol) lines.push(`Symbol: ${symbol}`);
  if (mikran) lines.push(`Kod Mikran: ${mikran}`);
  if (typeof thread.subiekt_tw_id === "number" && thread.subiekt_tw_id > 0) {
    lines.push("Powiązano z Subiektem");
  }
  return lines;
}

export function boardQuestionProductDraftFromThread(
  thread: Partial<BoardQuestionProductFields>
): BoardQuestionProductDraft {
  return {
    symbol: thread.product_symbol?.trim() ?? "",
    product: thread.product_name?.trim() ?? "",
    subiektTwId:
      typeof thread.subiekt_tw_id === "number" && thread.subiekt_tw_id > 0
        ? thread.subiekt_tw_id
        : null,
    mikranCode: thread.mikran_code?.trim() ?? "",
  };
}

export function boardQuestionProductFieldsFromDraft(
  draft: BoardQuestionProductDraft
): BoardQuestionProductFields | null {
  return normalizeBoardQuestionProductInput({
    symbol: draft.symbol,
    productName: draft.product,
    subiektTwId: draft.subiektTwId,
    mikranCode: draft.mikranCode,
  });
}

export function normalizeBoardQuestionProductInput(
  input?: BoardQuestionProductInput | null
): BoardQuestionProductFields | null {
  if (!input) return null;

  const product_symbol = normalizeBoardQuestionSymbol(input.symbol);
  const product_name = input.productName?.trim().slice(0, MAX_PRODUCT_TEXT_LEN) || null;
  const mikran_code = input.mikranCode?.trim().slice(0, MAX_MIKRAN_CODE_LEN) || null;
  const rawTwId = input.subiektTwId;
  const subiekt_tw_id =
    typeof rawTwId === "number" && Number.isFinite(rawTwId) && rawTwId > 0
      ? Math.trunc(rawTwId)
      : null;

  if (!product_symbol && !product_name && !mikran_code && !subiekt_tw_id) {
    return null;
  }

  return { product_symbol, product_name, subiekt_tw_id, mikran_code };
}

/** Ile produktów może mieć jedno pytanie na Tablicy (pierwszy w kolumnach wątku, reszta osobno). */
export const BOARD_QUESTION_MAX_PRODUCTS = 10;

function boardQuestionProductKey(fields: BoardQuestionProductFields): string {
  if (fields.subiekt_tw_id) return `tw:${fields.subiekt_tw_id}`;
  return [fields.product_symbol, fields.mikran_code, fields.product_name]
    .map((part) => part?.trim().toLowerCase() ?? "")
    .join("|");
}

/** Pomija puste i powtórzone pozycje, zachowuje kolejność z formularza. */
export function normalizeBoardQuestionProductList(
  input?: BoardQuestionProductInput | BoardQuestionProductInput[] | null
): BoardQuestionProductFields[] {
  const items = Array.isArray(input) ? input : input ? [input] : [];
  const seen = new Set<string>();
  const out: BoardQuestionProductFields[] = [];
  for (const item of items) {
    const fields = normalizeBoardQuestionProductInput(item);
    if (!fields) continue;
    const key = boardQuestionProductKey(fields);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fields);
    if (out.length >= BOARD_QUESTION_MAX_PRODUCTS) break;
  }
  return out;
}

/** Wiersz produktu w formularzu pytania — klucz trzyma stan pola przy usuwaniu wcześniejszych wierszy. */
export type BoardQuestionProductRow = { key: string; draft: BoardQuestionProductDraft };

/** Pierwszy wiersz ma stały klucz — od niego zależy id pola, a serwer i przeglądarka muszą dać to samo. */
export function initialBoardQuestionProductRows(): BoardQuestionProductRow[] {
  return [{ key: "p0", draft: emptyBoardQuestionProductDraft() }];
}

let boardQuestionProductRowSeq = 0;
/** Kolejne wiersze dodawane w przeglądarce (po kliknięciu) — licznik nie trafia do HTML z serwera. */
export function newBoardQuestionProductRow(): BoardQuestionProductRow {
  boardQuestionProductRowSeq += 1;
  return { key: `p${boardQuestionProductRowSeq}`, draft: emptyBoardQuestionProductDraft() };
}

/** „Dodaj kolejny produkt” dopiero, gdy każdy wiersz coś ma i jest miejsce. */
export function canAddBoardQuestionProduct(rows: readonly BoardQuestionProductRow[]): boolean {
  return rows.length < BOARD_QUESTION_MAX_PRODUCTS && rows.every((row) => boardQuestionDraftHasProduct(row.draft));
}
