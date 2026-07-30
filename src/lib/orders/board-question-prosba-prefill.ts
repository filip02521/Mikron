import { randomId } from "@/lib/ensure-crypto";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import {
  boardQuestionHasProduct,
  type BoardQuestionProductFields,
} from "@/lib/department-board/question-product";
import {
  MAX_MIKRAN_CODE_LEN,
  MAX_PRODUCT_TEXT_LEN,
  MAX_SYMBOL_LEN,
} from "@/lib/security/text-limits";

export const BOARD_QUESTION_PROSBA_PREFILL_STORAGE_KEY =
  "ontime-prosba-board-question-prefill";

export type BoardQuestionProsbaPrefill = {
  /** Id wątku na Tablicy (telemetria / debug). */
  threadId?: string | null;
  lines: ProductLineDraft[];
};

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function normalizeSymbol(value: unknown): string {
  const trimmed = String(value ?? "")
    .trim()
    .slice(0, MAX_SYMBOL_LEN);
  return trimmed === "-" ? "" : trimmed;
}

function normalizePrefillTwId(value: unknown): number | null {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Buduje jedną linię prośby z produktu przypiętego do pytania na Tablicy. */
export function buildBoardQuestionProsbaPrefill(
  product: Partial<BoardQuestionProductFields>,
  options?: { threadId?: string | null }
): BoardQuestionProsbaPrefill | null {
  if (!boardQuestionHasProduct(product)) return null;

  const symbol = normalizeSymbol(product.product_symbol);
  const productName =
    String(product.product_name ?? "")
      .trim()
      .slice(0, MAX_PRODUCT_TEXT_LEN) || symbol;
  const mikranCode = String(product.mikran_code ?? "")
    .trim()
    .slice(0, MAX_MIKRAN_CODE_LEN);
  const subiektTwId = normalizePrefillTwId(product.subiekt_tw_id);

  if (!symbol && !productName && !mikranCode && !subiektTwId) return null;

  const line: ProductLineDraft = {
    id: randomId(),
    symbol: symbol || "-",
    mikranCode,
    product: productName || symbol || "Produkt",
    quantity: "",
    subiektTwId,
    source: subiektTwId ? "subiekt" : null,
    stockSource: subiektTwId ? "subiekt" : null,
  };

  return {
    threadId: options?.threadId?.trim() || null,
    lines: [line],
  };
}

export function writeBoardQuestionProsbaPrefill(
  prefill: BoardQuestionProsbaPrefill
): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.setItem(
      BOARD_QUESTION_PROSBA_PREFILL_STORAGE_KEY,
      JSON.stringify(prefill)
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function readBoardQuestionProsbaPrefill(): BoardQuestionProsbaPrefill | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(
      BOARD_QUESTION_PROSBA_PREFILL_STORAGE_KEY
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BoardQuestionProsbaPrefill;
    if (!Array.isArray(parsed?.lines) || parsed.lines.length === 0) return null;
    const lines = parsed.lines
      .map((line) => {
        const symbol = normalizeSymbol(line?.symbol) || "-";
        const product =
          String(line?.product ?? "")
            .trim()
            .slice(0, MAX_PRODUCT_TEXT_LEN) || symbol;
        const mikranCode = String(line?.mikranCode ?? "")
          .trim()
          .slice(0, MAX_MIKRAN_CODE_LEN);
        const subiektTwId = normalizePrefillTwId(line?.subiektTwId);
        return {
          id: String(line?.id || randomId()),
          symbol,
          mikranCode,
          product,
          quantity: String(line?.quantity ?? "").trim(),
          subiektTwId,
          source: (line?.source === "subiekt" || line?.source === "catalog"
            ? line.source
            : subiektTwId
              ? "subiekt"
              : null) as ProductLineDraft["source"],
          stockSource: (line?.stockSource === "subiekt" || subiektTwId
            ? "subiekt"
            : null) as ProductLineDraft["stockSource"],
        } satisfies ProductLineDraft;
      })
      .filter((line) => line.product.trim() || line.symbol.trim() !== "-");
    if (!lines.length) return null;
    return {
      threadId:
        typeof parsed.threadId === "string" && parsed.threadId.trim()
          ? parsed.threadId.trim()
          : null,
      lines,
    };
  } catch {
    return null;
  }
}

export function clearBoardQuestionProsbaPrefill(): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.removeItem(BOARD_QUESTION_PROSBA_PREFILL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
