/**
 * Rozdzielanie towarów wspólnego zakresu między dostawców — czysta logika panelu.
 *
 * Szkic (`draft`) trzyma wybór per towar: id dostawcy albo "" (bez przypisania,
 * towar widzą wszyscy dostawcy zakresu). Zapis wysyła tylko różnice względem bazy.
 */

import type { ZdSharedScopeProduct } from "@/lib/data/zd-scope-order";

export type ZdSplitDraft = Readonly<Record<number, string>>;

export type ZdSplitFilter =
  | { kind: "all" }
  | { kind: "unassigned" }
  | { kind: "changed" }
  /** Wybór różny od podpowiedzi z historii ZD. */
  | { kind: "conflict" }
  /** Para paczka/sztuka z różnym wyborem po obu stronach. */
  | { kind: "pair" }
  /** Przypisane do dostawcy, który nie dzieli tego zakresu. */
  | { kind: "outside" }
  | { kind: "supplier"; supplierId: string };

/** Dane zakresu potrzebne części filtrów (pary, dostawcy spoza zakresu). */
export type ZdSplitContext = {
  byTw: ReadonlyMap<number, ZdSharedScopeProduct>;
  scopeSupplierIds: readonly string[];
};

export function zdSplitDraftFrom(products: readonly ZdSharedScopeProduct[]): Record<number, string> {
  return Object.fromEntries(products.map((p) => [p.subiektTwId, p.assignedSupplierId ?? ""]));
}

export function zdSplitValue(draft: ZdSplitDraft, p: ZdSharedScopeProduct): string {
  return draft[p.subiektTwId] ?? p.assignedSupplierId ?? "";
}

export function zdSplitChanged(
  products: readonly ZdSharedScopeProduct[],
  draft: ZdSplitDraft
): ZdSharedScopeProduct[] {
  return products.filter((p) => zdSplitValue(draft, p) !== (p.assignedSupplierId ?? ""));
}

function matchesQuery(p: ZdSharedScopeProduct, q: string): boolean {
  if (!q) return true;
  return (
    (p.twSymbol ?? "").toLowerCase().includes(q) ||
    p.twNazwa.toLowerCase().includes(q) ||
    String(p.subiektTwId) === q
  );
}

export function zdSplitMatches(
  p: ZdSharedScopeProduct,
  draft: ZdSplitDraft,
  filter: ZdSplitFilter,
  ctx?: ZdSplitContext
): boolean {
  const value = zdSplitValue(draft, p);
  switch (filter.kind) {
    case "all":
      return true;
    case "unassigned":
      return value === "";
    case "changed":
      return value !== (p.assignedSupplierId ?? "");
    case "conflict":
      return p.suggestedSupplierId != null && value !== p.suggestedSupplierId;
    case "supplier":
      return value === filter.supplierId;
    case "pair":
      return ctx ? zdSplitPairMismatch(p, draft, ctx.byTw) : false;
    case "outside":
      return ctx ? value !== "" && !ctx.scopeSupplierIds.includes(value) : false;
  }
}

export function zdSplitVisible(
  products: readonly ZdSharedScopeProduct[],
  draft: ZdSplitDraft,
  filter: ZdSplitFilter,
  query: string,
  ctx?: ZdSplitContext
): ZdSharedScopeProduct[] {
  const q = query.trim().toLowerCase();
  return products.filter((p) => matchesQuery(p, q) && zdSplitMatches(p, draft, filter, ctx));
}

/** Liczba towarów per wybór ("" = bez przypisania). */
export function zdSplitCounts(
  products: readonly ZdSharedScopeProduct[],
  draft: ZdSplitDraft
): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of products) {
    const v = zdSplitValue(draft, p);
    out.set(v, (out.get(v) ?? 0) + 1);
  }
  return out;
}

export function zdSplitAssign(
  draft: ZdSplitDraft,
  twIds: Iterable<number>,
  supplierId: string
): Record<number, string> {
  const next: Record<number, string> = { ...draft };
  for (const tw of twIds) next[tw] = supplierId;
  return next;
}

/**
 * Ustawia dostawcę z historii ZD; towary bez historii zostają bez zmian.
 * `onlyUnassigned` — nie nadpisuje wcześniejszych decyzji (akcja „dla wszystkich”);
 * dla jawnie zaznaczonych wierszy nadpisujemy.
 */
export function zdSplitApplyHistory(
  draft: ZdSplitDraft,
  products: readonly ZdSharedScopeProduct[],
  twIds?: ReadonlySet<number>,
  opts?: { onlyUnassigned?: boolean }
): Record<number, string> {
  const next: Record<number, string> = { ...draft };
  for (const p of products) {
    if (twIds && !twIds.has(p.subiektTwId)) continue;
    // Tylko towary bez decyzji: puste w szkicu i w zapisie (jawne zdjęcie przypisania zostaje).
    if (opts?.onlyUnassigned && (zdSplitValue(draft, p) !== "" || p.assignedSupplierId)) continue;
    if (p.suggestedSupplierId) next[p.subiektTwId] = p.suggestedSupplierId;
  }
  return next;
}

/** Ile towarów bez przypisania dostanie dostawcę z historii ZD. */
export function zdSplitHistoryFillCount(
  products: readonly ZdSharedScopeProduct[],
  draft: ZdSplitDraft
): number {
  return products.filter(
    (p) => p.suggestedSupplierId && zdSplitValue(draft, p) === "" && !p.assignedSupplierId
  ).length;
}

/**
 * Krótkie etykiety dostawców zakresu. Gdy skrót się powtarza (np. dwie spółki
 * „Dentsply Sirona …”), te dostawcy dostają pełną nazwę — przyciski muszą być rozróżnialne.
 */
export function zdSplitShortNames(names: readonly string[]): string[] {
  const shorts = names.map((n) => zdSplitShortName(n));
  return shorts.map((s, i) => (shorts.indexOf(s) !== i || shorts.lastIndexOf(s) !== i ? names[i] : s));
}

/**
 * Zaznaczenie zakresu Shift+klik: wiersze między kotwicą a celem (w kolejności
 * widocznej listy) dostają stan celu. Kotwica spoza listy = tylko cel.
 */
export function zdSplitRangeSelect(
  orderedIds: readonly number[],
  selected: ReadonlySet<number>,
  anchor: number | null,
  target: number,
  select: boolean
): Set<number> {
  const next = new Set(selected);
  const a = anchor == null ? -1 : orderedIds.indexOf(anchor);
  const b = orderedIds.indexOf(target);
  const [from, to] = a < 0 || b < 0 ? [b, b] : a < b ? [a, b] : [b, a];
  for (let i = from; i <= to && i >= 0; i++) {
    if (select) next.add(orderedIds[i]);
    else next.delete(orderedIds[i]);
  }
  return next;
}

/**
 * Krótka etykieta dostawcy na przycisku w wierszu (pełna nazwa w title):
 * bez formy prawnej, całe słowa do `max` znaków — bez wielokropka (DESIGN.md).
 */
const LEGAL_FORM_SUFFIX =
  /[\s,]+(sp\.?\s*z\s*o\.?\s*o\.?|sp\.?\s*k\.?|sp\.?\s*j\.?|sp\.?\s*p\.?|s\.?\s*a\.?|s\.?\s*c\.?|spółka\s+\S+|gmbh|ltd\.?|inc\.?|s\.?\s*r\.?\s*l\.?)$/i;

export function zdSplitShortName(name: string, max = 18): string {
  // Pętla zdejmuje formy złożone, np. „sp. z o.o. sp.k.”.
  let clean = name.replace(/\s+/g, " ").trim();
  for (let prev = ""; prev !== clean; ) {
    prev = clean;
    clean = clean
      .replace(LEGAL_FORM_SUFFIX, "")
      .replace(/[\s,.-]+$/, "")
      .trim();
  }
  if (clean.length <= max) return clean || name.trim();
  const words = clean.split(" ");
  let out = words[0];
  for (const w of words.slice(1)) {
    if (`${out} ${w}`.length > max) break;
    out = `${out} ${w}`;
  }
  // „Hager &” albo „Dental -” urwane na łączniku czyta się gorzej niż samo pierwsze słowo.
  return out.replace(/\s+(&|\+|-|i|and|und)$/i, "");
}

export type ZdSplitSort = "symbol" | "orders" | "recent";

function totalOrders(p: ZdSharedScopeProduct): number {
  let n = 0;
  for (const v of Object.values(p.orderCountBySupplier)) n += v > 0 ? v : 0;
  return n;
}

/** Sortowanie listy: symbol rosnąco, liczba ZD malejąco, ostatnie ZD od najnowszego. */
export function zdSplitSorted(
  products: readonly ZdSharedScopeProduct[],
  sort: ZdSplitSort
): ZdSharedScopeProduct[] {
  const bySymbol = (a: ZdSharedScopeProduct, b: ZdSharedScopeProduct) =>
    (a.twSymbol ?? "").localeCompare(b.twSymbol ?? "", "pl") || a.subiektTwId - b.subiektTwId;
  const out = [...products];
  if (sort === "orders") out.sort((a, b) => totalOrders(b) - totalOrders(a) || bySymbol(a, b));
  else if (sort === "recent")
    out.sort(
      (a, b) =>
        (b.lastOrderAt ? Date.parse(b.lastOrderAt) : 0) - (a.lastOrderAt ? Date.parse(a.lastOrderAt) : 0) ||
        bySymbol(a, b)
    );
  else out.sort(bySymbol);
  return out;
}

export type ZdSplitImpactRow = { value: string; before: number; after: number };

/**
 * Skutek zapisu per wybór ("" = bez przypisania): ile towarów było i ile będzie.
 * Tylko wiersze, które się zmieniają.
 */
export function zdSplitImpact(
  products: readonly ZdSharedScopeProduct[],
  draft: ZdSplitDraft
): ZdSplitImpactRow[] {
  const before = new Map<string, number>();
  const after = new Map<string, number>();
  for (const p of products) {
    const b = p.assignedSupplierId ?? "";
    const a = zdSplitValue(draft, p);
    before.set(b, (before.get(b) ?? 0) + 1);
    after.set(a, (after.get(a) ?? 0) + 1);
  }
  const keys = new Set([...before.keys(), ...after.keys()]);
  return [...keys]
    .map((value) => ({ value, before: before.get(value) ?? 0, after: after.get(value) ?? 0 }))
    .filter((r) => r.before !== r.after);
}

/**
 * Wybór drugiej strony pary paczka/sztuka: ze szkicu, gdy jest na liście,
 * inaczej zapisane przypisanie. Para znika u innych dostawców tylko przy zgodnym wyborze.
 */
export function zdSplitPairMismatch(
  p: ZdSharedScopeProduct,
  draft: ZdSplitDraft,
  byTw: ReadonlyMap<number, ZdSharedScopeProduct>
): boolean {
  if (!p.pair) return false;
  const other = byTw.get(p.pair.otherTwId);
  const otherValue = other ? zdSplitValue(draft, other) : (p.pair.otherAssignedSupplierId ?? "");
  return zdSplitValue(draft, p) !== otherValue;
}

/** Liczba niespójnych par (para liczona raz, nawet gdy obie strony są na liście). */
export function zdSplitPairMismatchCount(
  products: readonly ZdSharedScopeProduct[],
  draft: ZdSplitDraft,
  byTw: ReadonlyMap<number, ZdSharedScopeProduct>
): number {
  const keys = new Set<number>();
  for (const p of products) {
    if (!p.pair || !zdSplitPairMismatch(p, draft, byTw)) continue;
    keys.add(p.pair.role === "pack" ? p.subiektTwId : p.pair.otherTwId);
  }
  return keys.size;
}

/** Pary, które `zdSplitAlignPairs` faktycznie wyrówna (licznik na przycisku). */
export function zdSplitAlignablePairs(
  products: readonly ZdSharedScopeProduct[],
  draft: ZdSplitDraft,
  byTw: ReadonlyMap<number, ZdSharedScopeProduct>,
  scopeSupplierIds: readonly string[]
): number {
  return products.filter((pack) => {
    if (pack.pair?.role !== "pack") return false;
    const piece = byTw.get(pack.pair.otherTwId);
    if (!piece) return false;
    const packValue = zdSplitValue(draft, pack);
    const pieceValue = zdSplitValue(draft, piece);
    return packValue !== pieceValue && scopeSupplierIds.includes(packValue || pieceValue);
  }).length;
}

/**
 * Wyrównanie par z obiema stronami na liście. Paczkę kupujemy na ZD, więc jej wybór
 * wygrywa; paczka bez przypisania przejmuje dostawcę sztuk (nie kasujemy decyzji).
 */
export function zdSplitAlignPairs(
  products: readonly ZdSharedScopeProduct[],
  draft: ZdSplitDraft,
  byTw: ReadonlyMap<number, ZdSharedScopeProduct>,
  scopeSupplierIds: readonly string[]
): Record<number, string> {
  const next: Record<number, string> = { ...draft };
  for (const pack of products) {
    if (pack.pair?.role !== "pack") continue;
    const piece = byTw.get(pack.pair.otherTwId);
    if (!piece) continue;
    // Wartości ze szkicu wejściowego — wynik nie zależy od kolejności par.
    const packValue = zdSplitValue(draft, pack);
    const pieceValue = zdSplitValue(draft, piece);
    if (packValue === pieceValue) continue;
    const target = packValue || pieceValue;
    // Dostawcy spoza zakresu serwer nie przyjmie — taką parę trzeba rozstrzygnąć ręcznie.
    if (!scopeSupplierIds.includes(target)) continue;
    if (packValue) next[piece.subiektTwId] = packValue;
    else next[pack.subiektTwId] = pieceValue;
  }
  return next;
}
