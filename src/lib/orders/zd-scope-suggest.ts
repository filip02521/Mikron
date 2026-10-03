/**
 * Podpowiedzi zakresów (grupa / cecha) dla dostawcy — czysta logika.
 *
 * Wejście: towary z historii ZD dostawcy (product_supplier_links) z ich grupą
 * i cechami z indeksu Subiekta. Liczymy tylko towary, które kiedyś zamawialiśmy
 * — stare, niezamawiane pozycje katalogu nie wpływają na podpowiedź.
 *
 * - pokrycie: ile towarów dostawcy z ZD obejmują jego obecne zakresy,
 * - podpowiedź: zakres, który obejmuje najwięcej jeszcze nieobjętych towarów
 *   dostawcy i w którym dominują jego towary (czystość).
 */

import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";

export type ZdScopeRef = { mode: ZdEstimateRunMode; id: number };

export type ZdSupplierProductRow = {
  supplierId: string;
  twId: number;
  grupaId: number | null;
  cechaIds: readonly number[];
};

export type ZdScopeName = { name: string; productCount: number };

export type ZdScopeSuggestion = ZdScopeRef & {
  name: string;
  /** Towarów w zakresie w Subiekcie (wszystkich, także starych). */
  productCount: number;
  /** Ile nieobjętych jeszcze towarów dostawcy z ZD dojdzie po dodaniu. */
  newHits: number;
  /** Ile wszystkich towarów dostawcy z ZD jest w zakresie. */
  supplierHits: number;
  /** Udział dostawcy wśród towarów z ZD w tym zakresie (0–1). */
  purity: number;
  /** Inni dostawcy, od których kupujemy towary z tego zakresu. */
  otherSupplierCount: number;
};

export type ZdSupplierScopeInsight = {
  supplierId: string;
  /** Towary dostawcy z historii ZD (znane w indeksie). */
  totalProducts: number;
  /** Z tego objęte obecnymi zakresami. */
  coveredProducts: number;
  suggestions: ZdScopeSuggestion[];
};

export function zdScopeKey(ref: ZdScopeRef): string {
  return `${ref.mode}:${ref.id}`;
}

function scopesOfRow(row: ZdSupplierProductRow): ZdScopeRef[] {
  const out: ZdScopeRef[] = [];
  if (row.grupaId != null && row.grupaId > 0) out.push({ mode: "grupa", id: row.grupaId });
  for (const c of row.cechaIds) if (c > 0) out.push({ mode: "cecha", id: c });
  return out;
}

/** Minimalna czystość podpowiedzi — niżej zakres jest „cudzy” i tylko zaśmieca listę. */
export const ZD_SCOPE_SUGGEST_MIN_PURITY = 0.35;

/** Przy większej liczbie brakujących towarów pojedyncze trafienie to szum (np. „Grupa 1”). */
function minNewHits(uncovered: number): number {
  return uncovered >= 10 ? 2 : 1;
}

export function buildZdScopeInsights(input: {
  rows: readonly ZdSupplierProductRow[];
  currentScopes: ReadonlyMap<string, readonly ZdScopeRef[]>;
  names: ReadonlyMap<string, ZdScopeName>;
  maxSuggestions?: number;
}): Map<string, ZdSupplierScopeInsight> {
  const max = input.maxSuggestions ?? 3;

  // Towar → dostawcy (z ZD) i zakres → dostawcy / towary.
  const suppliersByScope = new Map<string, Set<string>>();
  const productsByScope = new Map<string, Set<number>>();
  const rowsBySupplier = new Map<string, ZdSupplierProductRow[]>();
  for (const row of input.rows) {
    const list = rowsBySupplier.get(row.supplierId) ?? [];
    list.push(row);
    rowsBySupplier.set(row.supplierId, list);
    for (const ref of scopesOfRow(row)) {
      const key = zdScopeKey(ref);
      (suppliersByScope.get(key) ?? suppliersByScope.set(key, new Set()).get(key)!).add(
        row.supplierId
      );
      (productsByScope.get(key) ?? productsByScope.set(key, new Set()).get(key)!).add(row.twId);
    }
  }

  const out = new Map<string, ZdSupplierScopeInsight>();
  const supplierIds = new Set([...rowsBySupplier.keys(), ...input.currentScopes.keys()]);
  for (const supplierId of supplierIds) {
    const rows = rowsBySupplier.get(supplierId) ?? [];
    const current = new Set((input.currentScopes.get(supplierId) ?? []).map(zdScopeKey));
    const products = new Map<number, ZdSupplierProductRow>();
    for (const r of rows) products.set(r.twId, r);

    let covered = 0;
    const newHits = new Map<string, number>();
    const supplierHits = new Map<string, number>();
    for (const row of products.values()) {
      const keys = scopesOfRow(row).map(zdScopeKey);
      const isCovered = keys.some((k) => current.has(k));
      if (isCovered) covered += 1;
      for (const k of keys) {
        supplierHits.set(k, (supplierHits.get(k) ?? 0) + 1);
        if (!isCovered) newHits.set(k, (newHits.get(k) ?? 0) + 1);
      }
    }

    const uncovered = products.size - covered;
    const candidates: (ZdScopeSuggestion & { score: number })[] = [];
    for (const [key, hits] of newHits) {
      if (current.has(key) || hits < minNewHits(uncovered)) continue;
      const [mode, idRaw] = key.split(":");
      const id = Number(idRaw);
      const linked = productsByScope.get(key)?.size ?? 0;
      const purity = linked > 0 ? (supplierHits.get(key) ?? 0) / linked : 0;
      if (purity < ZD_SCOPE_SUGGEST_MIN_PURITY) continue;
      const name = input.names.get(key);
      candidates.push({
        mode: mode === "cecha" ? "cecha" : "grupa",
        id,
        name: name?.name || `${mode === "cecha" ? "Cecha" : "Grupa"} ${id}`,
        productCount: name?.productCount ?? 0,
        newHits: hits,
        supplierHits: supplierHits.get(key) ?? 0,
        purity,
        otherSupplierCount: Math.max(0, (suppliersByScope.get(key)?.size ?? 1) - 1),
        score: (uncovered > 0 ? hits / uncovered : 0) * purity,
      });
    }
    candidates.sort(
      (a, b) =>
        b.score - a.score ||
        b.newHits - a.newHits ||
        // Przy remisie węższy zakres = mniej starych towarów w liście.
        (a.productCount || Infinity) - (b.productCount || Infinity) ||
        a.id - b.id
    );

    out.set(supplierId, {
      supplierId,
      totalProducts: products.size,
      coveredProducts: covered,
      suggestions: candidates.slice(0, max).map(({ score: _score, ...s }) => s),
    });
  }
  return out;
}
