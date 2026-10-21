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
  | { kind: "supplier"; supplierId: string };

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
  filter: ZdSplitFilter
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
  }
}

export function zdSplitVisible(
  products: readonly ZdSharedScopeProduct[],
  draft: ZdSplitDraft,
  filter: ZdSplitFilter,
  query: string
): ZdSharedScopeProduct[] {
  const q = query.trim().toLowerCase();
  return products.filter((p) => matchesQuery(p, q) && zdSplitMatches(p, draft, filter));
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

/** Ustawia dostawcę z historii ZD; towary bez historii zostają bez zmian. */
export function zdSplitApplyHistory(
  draft: ZdSplitDraft,
  products: readonly ZdSharedScopeProduct[],
  twIds?: ReadonlySet<number>
): Record<number, string> {
  const next: Record<number, string> = { ...draft };
  for (const p of products) {
    if (twIds && !twIds.has(p.subiektTwId)) continue;
    if (p.suggestedSupplierId) next[p.subiektTwId] = p.suggestedSupplierId;
  }
  return next;
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
export function zdSplitShortName(name: string, max = 18): string {
  const clean = name
    .replace(/\s+/g, " ")
    .replace(/[\s,]+(sp\.?\s*z\s*o\.?\s*o\.?|sp\.?\s*k\.?|sp\.?\s*j\.?|s\.?\s*a\.?|s\.?\s*c\.?)\s*$/i, "")
    .replace(/[\s,.-]+$/, "")
    .trim();
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
