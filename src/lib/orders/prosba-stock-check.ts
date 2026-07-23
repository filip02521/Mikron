import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { parseOrderQuantity } from "@/lib/orders/individual";
import { buildProsbaSufficientStockSummary } from "@/lib/orders/prosba-line-stock-ui";
import { isStockExemptTwId } from "@/lib/orders/teeth-stock-exempt";
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

/** Po tym czasie UI odblokowuje się i pozwala wybrać pozycje ręcznie (fetch w tle może trwać). */
export const PROSBA_STOCK_FETCH_UI_TIMEOUT_MS = 12_000;

/** Limit czasu batch fetchu na serwerze (zwraca częściowe wyniki). */
export const PROSBA_STOCK_FETCH_SERVER_TIMEOUT_MS = 20_000;

/** Maks. równoległych zapytań o stan pojedynczego towaru. */
export const PROSBA_STOCK_FETCH_MAX_CONCURRENT = 5;

export function isProsbaStockAckRequiredError(message: string): boolean {
  return message.includes(PROSBA_STOCK_ACK_REQUIRED_HINT);
}

/** Minimalny kształt pozycji ZK do wyboru zakresu prośby. */
export type ZkProsbaScopeLineInput = {
  key: string;
  subiektTwId: number | null;
  quantity: number | null;
};

export function zkWatchLineViewToProsbaScopeLine(line: {
  key: string;
  subiektTwId: number | null;
  quantity: number | null;
}): ZkProsbaScopeLineInput {
  return {
    key: line.key,
    subiektTwId: line.subiektTwId,
    quantity: line.quantity,
  };
}

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
  requestKind: IndividualRequestKind,
  stockExemptTwIds?: ReadonlySet<number>
): ProsbaLineStockAssessment {
  if (requestKind !== "zamowienie") return "unknown";
  if (isStockExemptTwId(line.subiektTwId, stockExemptTwIds)) return "unknown";
  const requestedQty = parseOrderQuantity(line.quantity);
  const stock = stockSnapshotFromLineDraft(line);
  return assessProsbaLineStock({ requestedQty, stock });
}

export function isProsbaLineStockSufficient(
  line: ProductLineDraft,
  requestKind: IndividualRequestKind,
  stockExemptTwIds?: ReadonlySet<number>
): boolean {
  return assessProsbaLineStockFromDraft(line, requestKind, stockExemptTwIds) === "sufficient";
}

export function filterProsbaLinesWithSufficientStock(
  lines: ProductLineDraft[],
  requestKind: IndividualRequestKind,
  stockExemptTwIds?: ReadonlySet<number>
): ProductLineDraft[] {
  return lines.filter((line) => isProsbaLineStockSufficient(line, requestKind, stockExemptTwIds));
}

/** Stan dialogu potwierdzenia wysyłki / zapisu przy pełnym stanie magazynowym. */
export function buildProsbaSubmitStockConfirm(
  lines: ProductLineDraft[],
  requestKind: IndividualRequestKind,
  stockExemptTwIds?: ReadonlySet<number>
): { sufficientLines: ProductLineDraft[]; message: string } | null {
  if (requestKind !== "zamowienie") return null;
  const sufficientLines = filterProsbaLinesWithSufficientStock(lines, requestKind, stockExemptTwIds);
  if (!sufficientLines.length) return null;
  return {
    sufficientLines,
    message: formatProsbaSubmitStockConfirmMessage(sufficientLines),
  };
}

export { formatProsbaStockLineHint } from "./prosba-line-stock-ui";

/** Poprawna odmiana „pozycja / pozycje / pozycji” w banerach formularza. */
export function formatProsbaSufficientStockBanner(count: number): string {
  const summary = buildProsbaSufficientStockSummary(count);
  if (!summary) return "";
  return `${summary.title} — ${summary.detail}`;
}

/** Podpowiedź w modalu ZK po auto-zaznaczeniu pozycji do zamówienia. */
export function formatZkProsbaAutoMarkedHint(count: number): string {
  if (count <= 0) return "";
  if (count === 1) {
    return "1 pozycja wymaga zamówienia — zaznaczono do prośby. Odznacz, jeśli macie ją na stanie.";
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  const few = mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14);
  const noun = few ? "pozycje" : "pozycji";
  const verb = few ? "wymagają" : "wymaga";
  return `${count} ${noun} ${verb} zamówienia — zaznaczono do prośby. Odznacz pozycje, które macie na stanie.`;
}

/** Etykieta statusu w modalu zakresu ZK (checkbox = pozycja do zamówienia). */
export function formatZkProsbaScopeLineBadge(input: {
  sufficient: boolean;
  markedForOrder: boolean;
  available: number | null;
  hasStockData: boolean;
  onHand?: number | null;
  reserved?: number | null;
  /** Ilość z linii ZK (do komunikatu o rezerwacji tego ZK). */
  zkLineQty?: number | null;
  /** Oryginalna rezerwacja z Subiekta (przed korektą o to ZK). */
  rawReserved?: number | null;
}): string {
  const reserveSuffix =
    input.hasStockData && input.reserved != null && input.reserved > 0
      ? ` (−${input.reserved} rez.)`
      : "";

  const zkReservedQty =
    input.zkLineQty != null && input.zkLineQty > 0
      ? Math.min(
          input.zkLineQty,
          input.rawReserved ?? 0
        )
      : 0;

  if (input.markedForOrder) {
    if (input.hasStockData && input.available != null && input.available > 0 && !input.sufficient) {
      return `Do zamówienia · stan ${input.available} szt.${reserveSuffix}`;
    }
    return "Do zamówienia";
  }
  if (input.sufficient && input.available != null) {
    if (zkReservedQty > 0) {
      return `Zarezerwowane w ZK: ${zkReservedQty} szt.`;
    }
    return `Na stanie: ${input.available} szt.${reserveSuffix}`;
  }
  if (!input.sufficient) {
    if (input.hasStockData && input.available != null && input.available > 0) {
      return `Do zamówienia · stan ${input.available} szt.${reserveSuffix}`;
    }
    return "Do zamówienia";
  }
  return "Pominięte";
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
  stockByTwId: Record<number, ProsbaLineStockSnapshot>,
  stockExemptTwIds?: ReadonlySet<number>
): boolean {
  if (isStockExemptTwId(line.subiektTwId, stockExemptTwIds)) return true;
  const twId = line.subiektTwId;
  if (!twId) return true;
  const snap = stockByTwId[twId];
  if (!snap) return true;
  return assessProsbaLineStock({ requestedQty: line.quantity, stock: snap }) !== "sufficient";
}

/**
 * Klucze pozycji z pełnym pokryciem stanem (nie wymagają zamówienia).
 * Gdy brak danych magazynowych — pusta lista.
 */
export function deriveZkProsbaScopeInStockKeys(
  lines: ZkProsbaScopeLineInput[],
  stockByTwId: Record<number, ProsbaLineStockSnapshot>,
  stockExemptTwIds?: ReadonlySet<number>
): string[] {
  const hasAnyStock = Object.keys(stockByTwId).length > 0;
  if (!hasAnyStock) return [];
  return lines
    .filter((line) => !zkProsbaScopeLineNeedsOrdering(line, stockByTwId, stockExemptTwIds))
    .map((line) => line.key);
}

/**
 * Klucze pozycji sugerowanych do zamówienia na podstawie stanu Subiekta.
 * Gdy brak danych magazynowych — pusta lista (użytkownik wybiera ręcznie).
 */
export function deriveZkProsbaScopeSuggestedOrderKeys(
  lines: ZkProsbaScopeLineInput[],
  stockByTwId: Record<number, ProsbaLineStockSnapshot>,
  stockExemptTwIds?: ReadonlySet<number>
): string[] {
  const hasAnyStock = Object.keys(stockByTwId).length > 0;
  if (!hasAnyStock) return [];
  return lines
    .filter((line) => zkProsbaScopeLineNeedsOrdering(line, stockByTwId, stockExemptTwIds))
    .map((line) => line.key);
}

/** Klucze pozycji zaznaczonych do zamówienia (checkbox zaznaczony). */
export function zkProsbaScopeLineKeysToOrder(
  lines: ZkProsbaScopeLineInput[],
  orderMarkedKeys: Iterable<string>
): string[] {
  const marked = new Set(orderMarkedKeys);
  return lines.filter((line) => marked.has(line.key)).map((line) => line.key);
}

/**
 * Początkowe zaznaczenie „do zamówienia” przy otwarciu modala.
 * - zapisany zakres → klucze z needs_prosba: true
 * - pierwsze ustawienie → needs_prosba z checków + auto z Subiekta (tylko wymagające zamówienia)
 */
export function buildZkProsbaScopeInitialOrderMarked(input: {
  lines: ZkProsbaScopeLineInput[];
  stockByTwId: Record<number, ProsbaLineStockSnapshot>;
  existingScope: string[] | null;
  needsProsbaByKey: ReadonlyMap<string, boolean>;
  stockExemptTwIds?: ReadonlySet<number>;
}): string[] {
  const { lines, stockByTwId, existingScope, needsProsbaByKey, stockExemptTwIds } = input;

  if (existingScope !== null) {
    return [...existingScope];
  }

  const autoFromStock = new Set(
    deriveZkProsbaScopeSuggestedOrderKeys(lines, stockByTwId, stockExemptTwIds)
  );
  const marked = new Set<string>();

  for (const line of lines) {
    const explicit = needsProsbaByKey.get(line.key);
    if (explicit === true) {
      marked.add(line.key);
    } else if (explicit === false) {
      continue;
    } else if (autoFromStock.has(line.key)) {
      marked.add(line.key);
    }
  }

  return [...marked];
}

/** @deprecated Użyj {@link buildZkProsbaScopeInitialOrderMarked}. */
export function buildZkProsbaScopeInitialInStockMarked(input: {
  lines: ZkProsbaScopeLineInput[];
  stockByTwId: Record<number, ProsbaLineStockSnapshot>;
  existingScope: string[] | null;
  needsProsbaByKey: ReadonlyMap<string, boolean>;
}): string[] {
  return buildZkProsbaScopeInitialOrderMarked(input);
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
 * Koryguje mapę stanu o rezerwacje z dodawanego ZK.
 *
 * Subiekt trzyma w tw_StanRez sumę rezerwacji ze wszystkich dokumentów,
 * w tym z dodawanego ZK. Bez korekty towar z pełnym stanem zarezerwowanym
 * przez to ZK pokazuje się jako „brak — do zamówienia”, podczas gdy
 * fizycznie jest na magazynie i zarezerwowany właśnie dla tego ZK.
 *
 * Korekta: reserved = max(0, reserved − suma ilości z linii ZK dla tw_Id),
 * available = onHand − adjustedReserved.
 */
export function adjustStockMapForZkLines(
  lines: ZkProsbaScopeLineInput[],
  stockByTwId: Record<number, ProsbaLineStockSnapshot>
): Record<number, ProsbaLineStockSnapshot> {
  const qtyByTwId = new Map<number, number>();
  for (const line of lines) {
    if (line.subiektTwId == null || line.quantity == null || line.quantity <= 0) continue;
    qtyByTwId.set(
      line.subiektTwId,
      (qtyByTwId.get(line.subiektTwId) ?? 0) + line.quantity
    );
  }

  const adjusted: Record<number, ProsbaLineStockSnapshot> = {};
  for (const [twId, qty] of qtyByTwId) {
    const snap = stockByTwId[twId];
    if (!snap) continue;
    const adjustedReserved = Math.max(0, snap.reserved - qty);
    adjusted[twId] = {
      onHand: snap.onHand,
      reserved: adjustedReserved,
      available: snap.onHand - adjustedReserved,
      source: snap.source,
    };
  }
  return adjusted;
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
  stockByTwId: Record<number, ProsbaLineStockSnapshot>,
  stockExemptTwIds?: ReadonlySet<number>
): string[] {
  const lineByKey = new Map(lines.map((line) => [line.key, line]));
  const result: string[] = [];
  for (const key of keys) {
    const line = lineByKey.get(key);
    if (!line || zkProsbaScopeLineNeedsOrdering(line, stockByTwId, stockExemptTwIds)) {
      result.push(key);
    }
  }
  return result;
}

/** Wszystkie pozycje ZK mają pełne pokrycie stanem (po załadowaniu danych). */
export function zkProsbaScopeAllLinesSufficient(
  lines: ZkProsbaScopeLineInput[],
  stockByTwId: Record<number, ProsbaLineStockSnapshot>,
  stockExemptTwIds?: ReadonlySet<number>
): boolean {
  if (!lines.length || !Object.keys(stockByTwId).length) return false;
  return lines.every((line) => {
    if (isStockExemptTwId(line.subiektTwId, stockExemptTwIds)) return false;
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
  requestKind: IndividualRequestKind,
  stockExemptTwIds?: ReadonlySet<number>
): number[] {
  if (requestKind !== "zamowienie") return [];
  const ids = new Set<number>();
  for (const line of lines) {
    const twId = line.subiektTwId;
    if (twId == null || twId <= 0) continue;
    if (isStockExemptTwId(twId, stockExemptTwIds)) continue;
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

export type ProsbaZkQuantityAssessment =
  | { kind: "match" }
  | {
      kind: "partial_stock";
      zkQuantity: number;
      orderQuantity: number;
      stockGap: number;
      available: number;
    }
  | {
      kind: "under_zk_no_stock";
      zkQuantity: number;
      orderQuantity: number;
      stockGap: number;
      available: number | null;
    }
  | {
      kind: "under_zk_insufficient_stock";
      zkQuantity: number;
      orderQuantity: number;
      stockGap: number;
      available: number;
    };

/** Różnica między ilością ZK a prośbą — zakładana część ze stanu magazynowego. */
export function computeZkProsbaQuantityGap(
  zkQuantity: number,
  orderQuantity: number
): number {
  return Math.max(0, zkQuantity - orderQuantity);
}

export function assessProsbaLineZkQuantity(input: {
  zkQuantity: number | null | undefined;
  orderQuantity: number | null;
  stock: ProsbaLineStockSnapshot | null;
}): ProsbaZkQuantityAssessment | null {
  const { zkQuantity, orderQuantity, stock } = input;
  if (zkQuantity == null || zkQuantity <= 0) return null;
  if (orderQuantity == null || orderQuantity <= 0) return null;
  if (orderQuantity >= zkQuantity) return { kind: "match" };

  const stockGap = computeZkProsbaQuantityGap(zkQuantity, orderQuantity);
  const available = stock?.available ?? null;

  if (available != null && available >= stockGap) {
    return {
      kind: "partial_stock",
      zkQuantity,
      orderQuantity,
      stockGap,
      available,
    };
  }
  if (available == null || available <= 0) {
    return {
      kind: "under_zk_no_stock",
      zkQuantity,
      orderQuantity,
      stockGap,
      available,
    };
  }
  return {
    kind: "under_zk_insufficient_stock",
    zkQuantity,
    orderQuantity,
    stockGap,
    available,
  };
}

export function assessProsbaLineZkQuantityFromDraft(
  line: ProductLineDraft,
  requestKind: IndividualRequestKind
): ProsbaZkQuantityAssessment | null {
  if (requestKind !== "zamowienie") return null;
  if (line.zkQuantity == null) return null;
  const orderQuantity = parseOrderQuantity(line.quantity);
  const stock = stockSnapshotFromLineDraft(line);
  return assessProsbaLineZkQuantity({
    zkQuantity: line.zkQuantity,
    orderQuantity,
    stock,
  });
}

function formatProsbaLineName(line: ProductLineDraft): string {
  return line.product.trim() || line.symbol.trim() || "Produkt";
}

function formatProsbaZkQuantityConfirmBullet(
  line: ProductLineDraft,
  assessment: Exclude<ProsbaZkQuantityAssessment, { kind: "match" }>
): string {
  const name = formatProsbaLineName(line);
  switch (assessment.kind) {
    case "partial_stock":
      return `• ${name} — ZK: ${assessment.zkQuantity} szt., prośba: ${assessment.orderQuantity} szt., ze stanu: ${assessment.stockGap} szt. (dostępne: ${assessment.available} szt.)`;
    case "under_zk_no_stock":
      return `• ${name} — ZK: ${assessment.zkQuantity} szt., prośba: ${assessment.orderQuantity} szt. (brak potwierdzonego stanu na brakujące ${assessment.stockGap} szt.)`;
    case "under_zk_insufficient_stock":
      return `• ${name} — ZK: ${assessment.zkQuantity} szt., prośba: ${assessment.orderQuantity} szt., brakuje ${assessment.stockGap} szt. względem ZK, na stanie: ${assessment.available} szt.`;
  }
}

/** Dialog przed wysyłką prośby z ZK, gdy ilość w prośbie < ilość w ZK. */
export function buildProsbaSubmitZkQuantityConfirm(
  lines: ProductLineDraft[],
  requestKind: IndividualRequestKind
): { title: string; message: string; confirmLabel: string } | null {
  if (requestKind !== "zamowienie") return null;

  const items: Array<{
    line: ProductLineDraft;
    assessment: Exclude<ProsbaZkQuantityAssessment, { kind: "match" }>;
  }> = [];

  for (const line of lines) {
    const assessment = assessProsbaLineZkQuantityFromDraft(line, requestKind);
    if (!assessment || assessment.kind === "match") continue;
    items.push({ line, assessment });
  }

  if (!items.length) return null;

  const hasPartialStock = items.some((item) => item.assessment.kind === "partial_stock");
  const bullets = items.map((item) =>
    formatProsbaZkQuantityConfirmBullet(item.line, item.assessment)
  );

  if (hasPartialStock && items.every((item) => item.assessment.kind === "partial_stock")) {
    return {
      title: "Częściowy stan magazynowy",
      message: `Ilość w prośbie jest mniejsza niż w ZK — reszta powinna być już na stanie:\n\n${bullets.join("\n")}\n\nCzy potwierdzasz podział i wysyłasz prośbę?`,
      confirmLabel: "Potwierdzam i wysyłam",
    };
  }

  return {
    title: "Ilość mniejsza niż w ZK",
    message: `Prośba obejmuje mniej sztuk niż pozycja w ZK:\n\n${bullets.join("\n")}\n\nCzy na pewno chcesz złożyć prośbę na taką ilość?`,
    confirmLabel: "Tak, wyślij prośbę",
  };
}

/** Krótka podpowiedź pod polem ilości (prefill z ZK). */
export function formatProsbaZkQuantityInlineHint(
  line: ProductLineDraft,
  requestKind: IndividualRequestKind
): string | null {
  const assessment = assessProsbaLineZkQuantityFromDraft(line, requestKind);
  if (!assessment || assessment.kind === "match") return null;

  switch (assessment.kind) {
    case "partial_stock":
      return `W ZK jest ${assessment.zkQuantity} szt. — ${assessment.stockGap} szt. ze stanu (dostępne: ${assessment.available}), reszta w prośbie.`;
    case "under_zk_no_stock":
      return `W ZK jest ${assessment.zkQuantity} szt. — prośba na ${assessment.orderQuantity} szt. (brak potwierdzonego stanu na brakujące ${assessment.stockGap} szt.).`;
    case "under_zk_insufficient_stock":
      return `W ZK jest ${assessment.zkQuantity} szt. — brakuje ${assessment.stockGap} szt. względem ZK, na stanie tylko ${assessment.available} szt.`;
  }
}

/** Baner formularza prośby powiązanej z ZK. */
export function formatProsbaZkQuantityFormBanner(
  lines: ProductLineDraft[],
  requestKind: IndividualRequestKind
): string | null {
  if (requestKind !== "zamowienie") return null;
  const hints = lines
    .map((line) => formatProsbaZkQuantityInlineHint(line, requestKind))
    .filter(Boolean);
  if (!hints.length) return null;
  if (hints.length === 1) return hints[0]!;
  return hints.join(" ");
}
