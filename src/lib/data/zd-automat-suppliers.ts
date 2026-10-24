/**
 * Lista dostawców do zarządzania automatem ZD (/zakupy/automat → Dostawcy): każdy aktywny dostawca z zakresem
 * w Kreatorze, jego Lokalizacja, kraj z Subiekta (kontrola), strategia i ostatni backtest. Tylko serwer.
 */
import { query } from "@/lib/db/pool";
import { listLatestZdBacktestVerdicts } from "@/lib/data/zd-backtest-run";
import {
  ZD_DEFAULT_CUTOFF_TIME,
  parseZdAutoLevel,
  parseZdCutoffTime,
  type ZdSupplierOrderPolicyRow,
} from "@/lib/data/zd-supplier-order-policy";
import { ZD_SUPPLIER_ORDER_POLICY_CLASSIC } from "@/lib/orders/zd-demand-policy";
import type { ZdBacktestParams } from "@/lib/data/zd-backtest-run";
import type { ZdBacktestVerdictKind } from "@/lib/orders/zd-backtest";

export type ZdAutomatSupplierRow = {
  id: string;
  name: string;
  /** Lokalizacja OnTime: POLSKA / ZAGRANICA / IMPORT. */
  location: string;
  subiektCountryId: number | null;
  subiektCountryName: string | null;
  policy: ZdSupplierOrderPolicyRow;
  backtest: {
    status: "queued" | "running" | "done" | "error";
    verdict: ZdBacktestVerdictKind | null;
    headline: string | null;
    at: string;
    params: ZdBacktestParams;
  } | null;
};

export async function loadZdAutomatSuppliers(): Promise<ZdAutomatSupplierRow[]> {
  const res = await query<{
    id: string;
    name: string;
    location: string | null;
    country: Record<string, unknown> | null;
    policy: Record<string, unknown> | null;
  }>(
    // to_jsonb: kolumny z migracji 194 czytają się także na bazie bez niej (wtedy null).
    `SELECT s.id, s.name, s.location,
            jsonb_build_object('id', to_jsonb(s.*) -> 'subiekt_country_id', 'name', to_jsonb(s.*) -> 'subiekt_country_name') AS country,
            to_jsonb(p.*) AS policy
       FROM suppliers s
       LEFT JOIN zd_supplier_order_policy p ON p.supplier_id = s.id
      WHERE s.is_active AND EXISTS (SELECT 1 FROM zd_estimate_supplier_scopes z WHERE z.supplier_id = s.id)
      ORDER BY s.name`
  );
  const backtests = await listLatestZdBacktestVerdicts();
  return res.rows.map((r) => {
    const p = r.policy;
    const strategy = p?.strategy === "max30_90" ? "max30_90" : "classic";
    const autoProposals = p?.auto_proposals === true;
    const policy: ZdSupplierOrderPolicyRow = p
      ? {
          strategy,
          targetDays: p.target_days == null ? null : Number(p.target_days),
          cycleDays: p.cycle_days == null ? null : Number(p.cycle_days),
          supplierId: r.id,
          autoProposals,
          autoLevel: Math.max(parseZdAutoLevel(p.auto_level), autoProposals ? 1 : 0) as ZdSupplierOrderPolicyRow["autoLevel"],
          cutoffTime: parseZdCutoffTime(p.cutoff_time) ?? ZD_DEFAULT_CUTOFF_TIME,
          updatedAt: p.updated_at ? new Date(String(p.updated_at)).toISOString() : null,
        }
      : { ...ZD_SUPPLIER_ORDER_POLICY_CLASSIC, supplierId: r.id, autoProposals: false, autoLevel: 0, cutoffTime: ZD_DEFAULT_CUTOFF_TIME, updatedAt: null };
    const countryId = r.country?.id == null ? null : Number(r.country.id);
    return {
      id: r.id,
      name: r.name,
      location: r.location ?? "",
      subiektCountryId: Number.isFinite(countryId) ? countryId : null,
      subiektCountryName: typeof r.country?.name === "string" ? r.country.name : null,
      policy,
      backtest: backtests.get(r.id) ?? null,
    };
  });
}
