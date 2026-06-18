import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { parseOrderQuantity } from "@/lib/orders/individual";
import type { SubiektProduct } from "@/lib/subiekt/types";
import type { IndividualRequestKind } from "@/types/database";

export type ProsbaLineStockSource = "subiekt";

export type ProsbaLineStockSnapshot = {
  onHand: number;
  reserved: number;
  available: number;
  source: ProsbaLineStockSource;
};

export type ProsbaLineStockAssessment = "unknown" | "unavailable" | "insufficient" | "sufficient";

/** Fragment komunikatu błędu serwera — wymagane potwierdzenie w formularzu. */
export const PROSBA_STOCK_ACK_REQUIRED_HINT = "Potwierdź wysyłkę w formularzu";

export function isProsbaStockAckRequiredError(message: string): boolean {
  return message.includes(PROSBA_STOCK_ACK_REQUIRED_HINT);
}

/** Minimalny kształt pozycji ZK do wyboru zakresu prośby. */
export type ZkProsbaScopeLineInput = {
  key: string;
  subiektTwId: number | null;
  quantity: number | null;
};

function parseStockNumber(value: unknown): number | null {
  if (value == null) return null;
  const n =
    typeof value === "number"
      ? value
      : Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Stan z pól Subiekta: dostępne = tw_Stan − tw_StanRez. */
export function stockSnapshotFromSubiektProduct(
  product: SubiektProduct
): ProsbaLineStockSnapshot | null {
  const onHand = parseStockNumber(product.tw_Stan);
  if (onHand === null) return null;
  const reserved = parseStockNumber(product.tw_StanRez) ?? 0;
  return {
    onHand,
    reserved,
    available: onHand - reserved,
    source: "subiekt",
  };
}

export function stockSnapshotFromLineDraft(
  line: Pick<ProductLineDraft, "onHand" | "reserved" | "available" | "stockSource">
): ProsbaLineStockSnapshot | null {
  if (line.stockSource !== "subiekt" || line.available == null) return null;
  const onHand = line.onHand;
  if (onHand == null || !Number.isFinite(onHand)) return null;
  return {
    onHand,
    reserved: line.reserved ?? 0,
    available: line.available,
    source: "subiekt",
  };
}

export function assessProsbaLineStock(input: {
  requestedQty: number | null;
  stock: ProsbaLineStockSnapshot | null;
}): ProsbaLineStockAssessment {
  const { requestedQty, stock } = input;
  if (requestedQty == null || requestedQty <= 0) return "unknown";
  if (!stock) return "unknown";
  if (stock.available >= requestedQty) return "sufficient";
  if (stock.available <= 0) return "unavailable";
  return "insufficient";
}

export function assessProsbaLineStockFromDraft(
  line: ProductLineDraft,
  requestKind: IndividualRequestKind
): ProsbaLineStockAssessment {
  if (requestKind !== "zamowienie") return "unknown";
  const requestedQty = parseOrderQuantity(line.quantity);
  const stock = stockSnapshotFromLineDraft(line);
  return assessProsbaLineStock({ requestedQty, stock });
}

export function isProsbaLineStockSufficient(
  line: ProductLineDraft,
  requestKind: IndividualRequestKind
): boolean {
  return assessProsbaLineStockFromDraft(line, requestKind) === "sufficient";
}

export function filterProsbaLinesWithSufficientStock(
  lines: ProductLineDraft[],
  requestKind: IndividualRequestKind
): ProductLineDraft[] {
  return lines.filter((line) => isProsbaLineStockSufficient(line, requestKind));
}

/** Stan dialogu potwierdzenia wysyłki / zapisu przy pełnym stanie magazynowym. */
export function buildProsbaSubmitStockConfirm(
  lines: ProductLineDraft[],
  requestKind: IndividualRequestKind
): { sufficientLines: ProductLineDraft[]; message: string } | null {
  if (requestKind !== "zamowienie") return null;
  const sufficientLines = filterProsbaLinesWithSufficientStock(lines, requestKind);
  if (!sufficientLines.length) return null;
  return {
    sufficientLines,
    message: formatProsbaSubmitStockConfirmMessage(sufficientLines),
  };
}

export function formatProsbaStockLineHint(
  line: Pick<ProductLineDraft, "product" | "symbol" | "quantity" | "available">
): string {
  const name = line.product.trim() || line.symbol.trim() || "Produkt";
  const qty = line.quantity.trim();
  const avail = line.available;
  const availLabel =
    avail != null && Number.isFinite(avail) ? `${avail} szt.` : "wystarczająco";
  return `Na stanie jest ${availLabel} — prośba może być zbędna przy zamówieniu ${qty} szt. (${name}).`;
}

/** Poprawna odmiana „pozycja / pozycje / pozycji” w banerach formularza. */
export function formatProsbaSufficientStockBanner(count: number): string {
  if (count <= 0) return "";
  if (count === 1) {
    return "1 pozycja ma wystarczający stan magazynowy — sprawdź, czy prośba jest potrzebna.";
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun =
    mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "pozycje" : "pozycji";
  return `${count} ${noun} mają wystarczający stan magazynowy — sprawdź, czy prośba jest potrzebna.`;
}

/** Podpowiedź w modalu ZK po auto-zaznaczeniu pozycji na stanie. */
export function formatZkProsbaAutoMarkedHint(count: number): string {
  if (count <= 0) return "";
  if (count === 1) {
    return "1 pozycja ma pełny stan — zaznaczono jako na stanie. Odznacz, jeśli mimo to chcesz zamówić.";
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  const few = mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14);
  const noun = few ? "pozycje" : "pozycji";
  const verb = few ? "mają" : "ma";
  return `${count} ${noun} ${verb} pełny stan — zaznaczono jako na stanie. Odznacz, jeśli mimo to chcesz zamówić.`;
}

/** Etykieta statusu w modalu zakresu ZK (checkbox = „na stanie”). */
export function formatZkProsbaScopeLineBadge(input: {
  sufficient: boolean;
  markedInStock: boolean;
  available: number | null;
  hasStockData: boolean;
}): string {
  if (input.markedInStock) {
    if (input.sufficient && input.available != null) {
      return `Na stanie: ${input.available} szt.`;
    }
    return "Na stanie";
  }
  if (input.hasStockData && input.available != null && input.available > 0 && !input.sufficient) {
    return `Stan: ${input.available} szt.`;
  }
  return "Do zamówienia";
}

export function isZkProsbaScopePartialStock(input: {
  sufficient: boolean;
  hasStockData: boolean;
  available: number | null;
}): boolean {
  return (
    !input.sufficient &&
    input.hasStockData &&
    input.available != null &&
    input.available > 0
  );
}

/** Czy pozycja ZK wymaga zamówienia (nie ma pełnego pokrycia stanem). */
export function zkProsbaScopeLineNeedsOrdering(
  line: ZkProsbaScopeLineInput,
  stockByTwId: Record<number, ProsbaLineStockSnapshot>
): boolean {
  const twId = line.subiektTwId;
  if (!twId) return true;
  const snap = stockByTwId[twId];
  if (!snap) return true;
  return assessProsbaLineStock({ requestedQty: line.quantity, stock: snap }) !== "sufficient";
}

/**
 * Klucze pozycji oznaczonych jako „na stanie” (checkbox zaznaczony).
 * Gdy brak danych magazynowych — pusta lista (nic nie oznaczamy automatycznie).
 */
export function deriveZkProsbaScopeInStockKeys(
  lines: ZkProsbaScopeLineInput[],
  stockByTwId: Record<number, ProsbaLineStockSnapshot>
): string[] {
  const hasAnyStock = Object.keys(stockByTwId).length > 0;
  if (!hasAnyStock) return [];
  return lines
    .filter((line) => !zkProsbaScopeLineNeedsOrdering(line, stockByTwId))
    .map((line) => line.key);
}

export function zkProsbaScopeLineKeysToOrder(
  lines: ZkProsbaScopeLineInput[],
  inStockMarkedKeys: Iterable<string>
): string[] {
  const marked = new Set(inStockMarkedKeys);
  return lines.filter((line) => !marked.has(line.key)).map((line) => line.key);
}

/**
 * Początkowe zaznaczenie „na stanie” przy otwarciu modala.
 * - zapisany zakres → odwzorowanie needs_prosba
 * - pierwsze ustawienie → needs_prosba z checków + auto z Subiekta (tylko pełne pokrycie)
 */
export function buildZkProsbaScopeInitialInStockMarked(input: {
  lines: ZkProsbaScopeLineInput[];
  stockByTwId: Record<number, ProsbaLineStockSnapshot>;
  existingScope: string[] | null;
  needsProsbaByKey: ReadonlyMap<string, boolean>;
}): string[] {
  const { lines, stockByTwId, existingScope, needsProsbaByKey } = input;

  if (existingScope !== null) {
    const orderKeys = new Set(existingScope);
    return lines.filter((line) => !orderKeys.has(line.key)).map((line) => line.key);
  }

  const autoFromStock = new Set(deriveZkProsbaScopeInStockKeys(lines, stockByTwId));
  const marked = new Set<string>();

  for (const line of lines) {
    const explicit = needsProsbaByKey.get(line.key);
    if (explicit === false) {
      marked.add(line.key);
    } else if (explicit === true) {
      continue;
    } else if (autoFromStock.has(line.key)) {
      marked.add(line.key);
    }
  }

  return [...marked];
}

/** tw_Id pozycji ZK do pobrania stanu z Subiekta. */
export function collectZkProsbaScopeLineTwIds(lines: ZkProsbaScopeLineInput[]): number[] {
  return [
    ...new Set(
      lines
        .map((line) => line.subiektTwId)
        .filter((id): id is number => id != null && id > 0)
        .map((id) => Math.trunc(id))
    ),
  ];
}

/**
 * Czy pobranie stanu z Subiekta nie powiodło się: są towary do sprawdzenia,
 * a mapa stanu jest pusta lub brakuje wpisów dla żądanych tw_Id.
 */
export function zkProsbaScopeStockFetchFailed(
  lines: ZkProsbaScopeLineInput[],
  stockByTwId: Record<number, ProsbaLineStockSnapshot>
): boolean {
  const twIds = collectZkProsbaScopeLineTwIds(lines);
  if (!twIds.length) return false;
  if (!Object.keys(stockByTwId).length) return true;
  return twIds.some((twId) => !stockByTwId[twId]);
}

/** @deprecated Użyj {@link zkProsbaScopeStockFetchFailed} z mapą stanu po fetchu. */
export function zkProsbaScopeStockUnavailable(lines: ZkProsbaScopeLineInput[]): boolean {
  return collectZkProsbaScopeLineTwIds(lines).length > 0;
}

/** Klucze pozycji wymagających zamówienia — pomija te z pełnym pokryciem stanem. */
export function filterZkProsbaScopeLineKeysNeedingOrder(
  lines: ZkProsbaScopeLineInput[],
  keys: Iterable<string>,
  stockByTwId: Record<number, ProsbaLineStockSnapshot>
): string[] {
  const lineByKey = new Map(lines.map((line) => [line.key, line]));
  const result: string[] = [];
  for (const key of keys) {
    const line = lineByKey.get(key);
    if (!line || zkProsbaScopeLineNeedsOrdering(line, stockByTwId)) {
      result.push(key);
    }
  }
  return result;
}

/** Wszystkie pozycje ZK mają pełne pokrycie stanem (po załadowaniu danych). */
export function zkProsbaScopeAllLinesSufficient(
  lines: ZkProsbaScopeLineInput[],
  stockByTwId: Record<number, ProsbaLineStockSnapshot>
): boolean {
  if (!lines.length || !Object.keys(stockByTwId).length) return false;
  return lines.every((line) => {
    const twId = line.subiektTwId;
    if (!twId) return false;
    const snap = stockByTwId[twId];
    if (!snap) return false;
    return assessProsbaLineStock({ requestedQty: line.quantity, stock: snap }) === "sufficient";
  });
}

/** tw_Id pozycji prośby bez wczytanego stanu (do batch fetch). */
export function collectProsbaLineTwIdsMissingStock(
  lines: ProductLineDraft[],
  requestKind: IndividualRequestKind
): number[] {
  if (requestKind !== "zamowienie") return [];
  const ids = new Set<number>();
  for (const line of lines) {
    const twId = line.subiektTwId;
    if (twId == null || twId <= 0) continue;
    if (line.stockSource === "subiekt" && line.available != null) continue;
    ids.add(Math.trunc(twId));
  }
  return [...ids];
}

/** Sygnatura linii do odświeżenia stanu (tw_Id + ilość). */
export function prosbaLinesStockSyncSignature(
  lines: ProductLineDraft[],
  requestKind: IndividualRequestKind
): string {
  if (requestKind !== "zamowienie") return "";
  return lines
    .map((line) => {
      const twId = line.subiektTwId;
      if (twId == null || twId <= 0) return "";
      return `${Math.trunc(twId)}:${line.quantity.trim()}`;
    })
    .filter(Boolean)
    .join("\0");
}

export function uniqueProsbaLineTwIds(lines: ProductLineDraft[]): number[] {
  return [
    ...new Set(
      lines
        .map((line) => line.subiektTwId)
        .filter((id): id is number => id != null && id > 0)
        .map((id) => Math.trunc(id))
    ),
  ];
}

export function applyProsbaLineStockMap(
  lines: ProductLineDraft[],
  stock: Record<number, ProsbaLineStockSnapshot>
): { next: ProductLineDraft[]; changed: boolean } {
  let changed = false;
  const next = lines.map((line) => {
    const twId = line.subiektTwId;
    if (!twId) return line;
    const snap = stock[twId];
    if (!snap) return line;
    const patch = mergeStockIntoLinePatch(snap);
    if (
      line.onHand === patch.onHand &&
      line.reserved === patch.reserved &&
      line.available === patch.available &&
      line.stockSource === patch.stockSource
    ) {
      return line;
    }
    changed = true;
    return { ...line, ...patch };
  });
  return { next, changed };
}

export function formatProsbaSubmitStockConfirmMessage(lines: ProductLineDraft[]): string {
  const names = lines.map((line) => {
    const name = line.product.trim() || line.symbol.trim() || "Produkt";
    const qty = line.quantity.trim();
    const avail = line.available;
    const availPart = avail != null ? ` (stan: ${avail} szt.)` : "";
    return `• ${name} — ${qty} szt.${availPart}`;
  });
  return `Część pozycji ma wystarczający stan magazynowy:\n\n${names.join("\n")}\n\nCzy na pewno wysłać prośbę o zamówienie?`;
}

export function mergeStockIntoLinePatch(
  snap: ProsbaLineStockSnapshot | null
): Partial<ProductLineDraft> {
  if (!snap) {
    return {
      onHand: undefined,
      reserved: undefined,
      available: undefined,
      stockSource: undefined,
    };
  }
  return {
    onHand: snap.onHand,
    reserved: snap.reserved,
    available: snap.available,
    stockSource: snap.source,
  };
}
