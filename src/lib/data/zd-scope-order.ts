import { query } from "@/lib/db/pool";
import {
  groupZdEstimateScopesBySupplier,
  listZdEstimateSupplierScopes,
  type ZdEstimateSupplierScopeRow,
} from "@/lib/data/zd-estimate-supplier-scopes";
import {
  buildZdScopeInsights,
  zdScopeKey,
  type ZdScopeName,
  type ZdScopeRef,
  type ZdSupplierProductRow,
  type ZdSupplierScopeInsight,
} from "@/lib/orders/zd-scope-suggest";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Podpowiedzi zakresów
// ---------------------------------------------------------------------------

export type ZdScopeInsightsBundle = {
  /** null = indeks jeszcze nie zbudowany (brak podpowiedzi). */
  indexSyncedAt: string | null;
  insights: ZdSupplierScopeInsight[];
};

export async function loadZdScopeNames(): Promise<Map<string, ZdScopeName>> {
  const res = await query<{ kind: string; scope_id: number; name: string; product_count: number }>(
    `SELECT kind, scope_id, name, product_count FROM subiekt_scope_names`
  );
  const out = new Map<string, ZdScopeName>();
  for (const r of res.rows) {
    out.set(zdScopeKey({ mode: r.kind === "cecha" ? "cecha" : "grupa", id: num(r.scope_id) }), {
      name: r.name,
      productCount: num(r.product_count),
    });
  }
  return out;
}

/**
 * Towary z historii ZD (i ręczne przypisania) aktywnych dostawców z grupą i cechami
 * z indeksu. Towar spoza indeksu (np. usunięty w Subiekcie) nie liczy się.
 */
async function loadSupplierProductRows(): Promise<ZdSupplierProductRow[]> {
  const res = await query<{
    supplier_id: string;
    subiekt_tw_id: number;
    grupa_id: number | null;
    cecha_ids: number[] | null;
  }>(
    `SELECT DISTINCT x.supplier_id, x.subiekt_tw_id, i.grupa_id, i.cecha_ids
       FROM (
         SELECT supplier_id, subiekt_tw_id FROM product_supplier_links
         UNION
         SELECT supplier_id, subiekt_tw_id FROM zd_product_supplier_assignments
       ) x
       JOIN subiekt_product_scope_index i ON i.subiekt_tw_id = x.subiekt_tw_id
       JOIN suppliers s ON s.id = x.supplier_id
      WHERE COALESCE(s.is_active, true)`
  );
  return res.rows.map((r) => ({
    supplierId: r.supplier_id,
    twId: num(r.subiekt_tw_id),
    grupaId: r.grupa_id != null ? num(r.grupa_id) : null,
    cechaIds: (r.cecha_ids ?? []).map(num),
  }));
}

export async function loadZdScopeInsights(
  scopes?: readonly ZdEstimateSupplierScopeRow[]
): Promise<ZdScopeInsightsBundle> {
  const [syncedRes, names, rows, scopeRows] = await Promise.all([
    query<{ at: Date | null }>(`SELECT max(synced_at) AS at FROM subiekt_scope_names`),
    loadZdScopeNames(),
    loadSupplierProductRows(),
    scopes ? Promise.resolve(scopes) : listZdEstimateSupplierScopes(),
  ]);
  const at = syncedRes.rows[0]?.at ?? null;
  if (!at) return { indexSyncedAt: null, insights: [] };

  const currentScopes = new Map<string, ZdScopeRef[]>();
  for (const [supplierId, list] of groupZdEstimateScopesBySupplier(scopeRows)) {
    currentScopes.set(
      supplierId,
      list.map((s) => ({ mode: s.mode, id: (s.mode === "cecha" ? s.cechaId : s.grupaId) ?? 0 }))
    );
  }
  const insights = buildZdScopeInsights({ rows, currentScopes, names });
  return { indexSyncedAt: new Date(at).toISOString(), insights: [...insights.values()] };
}

// ---------------------------------------------------------------------------
// Wspólne zakresy i przypisania towarów
// ---------------------------------------------------------------------------

export type ZdSharedScope = {
  mode: ZdEstimateRunMode;
  scopeId: number;
  label: string;
  supplierIds: string[];
};

/** Zakresy przypisane do co najmniej dwóch dostawców. */
export function findZdSharedScopes(
  scopes: readonly ZdEstimateSupplierScopeRow[]
): ZdSharedScope[] {
  const byKey = new Map<string, ZdSharedScope>();
  for (const s of scopes) {
    const scopeId = (s.mode === "cecha" ? s.cechaId : s.grupaId) ?? 0;
    if (!(scopeId > 0)) continue;
    const key = zdScopeKey({ mode: s.mode, id: scopeId });
    const hit = byKey.get(key) ?? { mode: s.mode, scopeId, label: s.label, supplierIds: [] };
    if (!hit.supplierIds.includes(s.supplierId)) hit.supplierIds.push(s.supplierId);
    if (!hit.label && s.label) hit.label = s.label;
    byKey.set(key, hit);
  }
  return [...byKey.values()].filter((s) => s.supplierIds.length > 1);
}

export type ZdProductAssignment = {
  subiektTwId: number;
  supplierId: string;
  twSymbol: string | null;
  twNazwa: string;
  note: string;
  updatedAt: string;
};

export async function loadZdProductAssignments(
  twIds?: readonly number[]
): Promise<Map<number, ZdProductAssignment>> {
  const res = twIds
    ? await query<Record<string, unknown>>(
        `SELECT * FROM zd_product_supplier_assignments WHERE subiekt_tw_id = ANY($1::int[])`,
        [[...new Set(twIds)]]
      )
    : await query<Record<string, unknown>>(`SELECT * FROM zd_product_supplier_assignments`);
  const out = new Map<number, ZdProductAssignment>();
  for (const r of res.rows) {
    out.set(num(r.subiekt_tw_id), {
      subiektTwId: num(r.subiekt_tw_id),
      supplierId: String(r.supplier_id),
      twSymbol: (r.tw_symbol as string | null) ?? null,
      twNazwa: String(r.tw_nazwa ?? ""),
      note: String(r.note ?? ""),
      updatedAt: new Date(r.updated_at as string).toISOString(),
    });
  }
  return out;
}

export async function setZdProductAssignments(
  items: readonly {
    subiektTwId: number;
    /** null = usuń przypisanie (towar wraca do wszystkich dostawców zakresu). */
    supplierId: string | null;
    twSymbol: string | null;
    twNazwa: string;
  }[],
  updatedBy: string | null
): Promise<void> {
  const toDelete = items.filter((i) => !i.supplierId).map((i) => i.subiektTwId);
  const toSet = items.filter((i) => i.supplierId);
  if (toDelete.length) {
    await query(`DELETE FROM zd_product_supplier_assignments WHERE subiekt_tw_id = ANY($1::int[])`, [
      toDelete,
    ]);
  }
  if (toSet.length) {
    await query(
      `INSERT INTO zd_product_supplier_assignments
         (subiekt_tw_id, supplier_id, tw_symbol, tw_nazwa, updated_at, updated_by)
       SELECT t.tw, t.sid::uuid, t.sym, COALESCE(t.nm, ''), now(), $2
         FROM jsonb_to_recordset($1::jsonb) AS t(tw int, sid text, sym text, nm text)
       ON CONFLICT (subiekt_tw_id) DO UPDATE SET
         supplier_id = EXCLUDED.supplier_id,
         tw_symbol = EXCLUDED.tw_symbol,
         tw_nazwa = EXCLUDED.tw_nazwa,
         updated_at = now(),
         updated_by = EXCLUDED.updated_by`,
      [
        JSON.stringify(
          toSet.map((i) => ({
            tw: i.subiektTwId,
            sid: i.supplierId,
            sym: i.twSymbol,
            nm: i.twNazwa.slice(0, 500),
          }))
        ),
        updatedBy,
      ]
    );
  }
}

export type ZdSharedScopeProduct = {
  subiektTwId: number;
  twSymbol: string | null;
  twNazwa: string;
  /** Liczba ZD per dostawca (tylko dostawcy dzielący zakres). */
  orderCountBySupplier: Record<string, number>;
  /** Podpowiedź z historii ZD: dostawca z największą liczbą zamówień. */
  suggestedSupplierId: string | null;
  assignedSupplierId: string | null;
};

/**
 * Towary wspólnego zakresu, które kupujemy od któregoś z dzielących go dostawców
 * (albo już przypisane). Stare towary bez historii ZD nie są pokazywane.
 */
export async function loadZdSharedScopeProducts(input: {
  mode: ZdEstimateRunMode;
  scopeId: number;
  supplierIds: readonly string[];
}): Promise<ZdSharedScopeProduct[]> {
  const scopeFilter =
    input.mode === "cecha" ? `$1 = ANY(i.cecha_ids)` : `i.grupa_id = $1`;
  const res = await query<{
    subiekt_tw_id: number;
    symbol: string | null;
    name: string | null;
    supplier_id: string | null;
    order_count: number | null;
    assigned: string | null;
  }>(
    `SELECT i.subiekt_tw_id, p.symbol, p.name, l.supplier_id, l.order_count,
            a.supplier_id AS assigned
       FROM subiekt_product_scope_index i
       LEFT JOIN subiekt_products p ON p.subiekt_tw_id = i.subiekt_tw_id
       LEFT JOIN product_supplier_links l
         ON l.subiekt_tw_id = i.subiekt_tw_id AND l.supplier_id = ANY($2::uuid[])
       LEFT JOIN zd_product_supplier_assignments a ON a.subiekt_tw_id = i.subiekt_tw_id
      WHERE ${scopeFilter}
        AND (l.supplier_id IS NOT NULL OR a.supplier_id IS NOT NULL)`,
    [input.scopeId, [...input.supplierIds]]
  );
  const byTw = new Map<number, ZdSharedScopeProduct>();
  for (const r of res.rows) {
    const tw = num(r.subiekt_tw_id);
    const hit =
      byTw.get(tw) ??
      ({
        subiektTwId: tw,
        twSymbol: r.symbol,
        twNazwa: r.name ?? "",
        orderCountBySupplier: {},
        suggestedSupplierId: null,
        assignedSupplierId: r.assigned,
      } satisfies ZdSharedScopeProduct);
    if (r.supplier_id) hit.orderCountBySupplier[r.supplier_id] = num(r.order_count);
    byTw.set(tw, hit);
  }
  for (const p of byTw.values()) {
    let best: [string, number] | null = null;
    for (const [sid, n] of Object.entries(p.orderCountBySupplier)) {
      if (!best || n > best[1]) best = [sid, n];
    }
    p.suggestedSupplierId = best?.[0] ?? null;
  }
  return [...byTw.values()].sort((a, b) =>
    (a.twSymbol ?? "").localeCompare(b.twSymbol ?? "", "pl")
  );
}

/**
 * Ostatni dostawca towaru z historii ZD (najnowsza akcja) — podpowiedź w Kreatorze,
 * gdy towar z zakresu kupowaliśmy ostatnio u kogoś innego.
 */
export async function loadLastZdSupplierByTwIds(
  twIds: readonly number[]
): Promise<Map<number, { supplierId: string; supplierName: string }>> {
  const ids = [...new Set(twIds.filter((t) => t > 0))];
  const out = new Map<number, { supplierId: string; supplierName: string }>();
  if (!ids.length) return out;
  const res = await query<{ subiekt_tw_id: number; supplier_id: string; name: string }>(
    `SELECT DISTINCT ON (l.subiekt_tw_id) l.subiekt_tw_id, l.supplier_id, s.name
       FROM product_supplier_links l
       JOIN suppliers s ON s.id = l.supplier_id
      WHERE l.subiekt_tw_id = ANY($1::int[])
      ORDER BY l.subiekt_tw_id, l.last_action_at DESC, l.order_count DESC`,
    [ids]
  );
  for (const r of res.rows) {
    out.set(num(r.subiekt_tw_id), { supplierId: r.supplier_id, supplierName: r.name });
  }
  return out;
}
