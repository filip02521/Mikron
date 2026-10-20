import { query } from "@/lib/db/pool";
import {
  ZD_SUPPLIER_ORDER_POLICY_CLASSIC,
  type ZdDemandStrategy,
  type ZdSupplierOrderPolicy,
} from "@/lib/orders/zd-demand-policy";

export type ZdSupplierOrderPolicyRow = ZdSupplierOrderPolicy & {
  supplierId: string;
  autoProposals: boolean;
  updatedAt: string | null;
};

function parseStrategy(v: unknown): ZdDemandStrategy {
  return v === "max30_90" ? "max30_90" : "classic";
}

function intOrNull(v: unknown, lo: number, hi: number): number | null {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}

function isUndefinedTable(e: unknown): boolean {
  return typeof e === "object" && e != null && (e as { code?: unknown }).code === "42P01";
}

/**
 * Brak wiersza = classic (jak dotąd). Brak tabeli (migracja 190 jeszcze niewgrana) też classic,
 * żeby wdrożenie kodu przed migracją nie zatrzymało Kreatora. Inny błąd bazy leci wyjątkiem —
 * silnik pokazuje „reguły niedostępne”.
 */
export async function fetchZdSupplierOrderPolicy(supplierId: string): Promise<ZdSupplierOrderPolicyRow> {
  const classic = { ...ZD_SUPPLIER_ORDER_POLICY_CLASSIC, supplierId, autoProposals: false, updatedAt: null };
  let res;
  try {
    res = await query<{
    strategy: string;
    target_days: number | null;
    cycle_days: number | null;
    auto_proposals: boolean;
    updated_at: Date | string;
  }>(
    `SELECT strategy, target_days, cycle_days, auto_proposals, updated_at
       FROM zd_supplier_order_policy WHERE supplier_id = $1`,
    [supplierId]
  );
  } catch (e) {
    if (isUndefinedTable(e)) return classic;
    throw e;
  }
  const r = res.rows[0];
  if (!r) return classic;
  return {
    supplierId,
    strategy: parseStrategy(r.strategy),
    targetDays: intOrNull(r.target_days, 1, 180),
    cycleDays: intOrNull(r.cycle_days, 1, 60),
    autoProposals: r.auto_proposals === true,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function upsertZdSupplierOrderPolicy(input: {
  supplierId: string;
  strategy: ZdDemandStrategy;
  targetDays: number | null;
  cycleDays: number | null;
  autoProposals: boolean;
  updatedBy: string | null;
}): Promise<ZdSupplierOrderPolicyRow> {
  await query(
    `INSERT INTO zd_supplier_order_policy (supplier_id, strategy, target_days, cycle_days, auto_proposals, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, $5, now(), $6)
     ON CONFLICT (supplier_id) DO UPDATE SET
       strategy = EXCLUDED.strategy, target_days = EXCLUDED.target_days, cycle_days = EXCLUDED.cycle_days,
       auto_proposals = EXCLUDED.auto_proposals, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [
      input.supplierId,
      parseStrategy(input.strategy),
      intOrNull(input.targetDays, 1, 180),
      intOrNull(input.cycleDays, 1, 60),
      input.autoProposals === true,
      input.updatedBy,
    ]
  );
  return fetchZdSupplierOrderPolicy(input.supplierId);
}

/** Dostawcy z włączonymi propozycjami automatu (nocny przebieg). */
export async function listZdSuppliersWithAutoProposals(): Promise<ZdSupplierOrderPolicyRow[]> {
  let res;
  try {
    res = await query<{ supplier_id: string }>(
      `SELECT supplier_id FROM zd_supplier_order_policy WHERE auto_proposals = true AND cycle_days IS NOT NULL`
    );
  } catch (e) {
    if (isUndefinedTable(e)) return [];
    throw e;
  }
  return Promise.all(res.rows.map((r) => fetchZdSupplierOrderPolicy(r.supplier_id)));
}
