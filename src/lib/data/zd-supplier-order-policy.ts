import { isUndefinedTableError, query } from "@/lib/db/pool";
import {
  ZD_SUPPLIER_ORDER_POLICY_CLASSIC,
  type ZdDemandStrategy,
  type ZdSupplierOrderPolicy,
} from "@/lib/orders/zd-demand-policy";

/** Stopień autonomii automatu ZD (spec §4.4): 0 jak dziś … 4 auto-mail. */
export type ZdAutoLevel = 0 | 1 | 2 | 3 | 4;

/** Domyślna godzina odcięcia dla handlowców (dzień przed wysyłką). */
export const ZD_DEFAULT_CUTOFF_TIME = "14:00";

export type ZdSupplierOrderPolicyRow = ZdSupplierOrderPolicy & {
  supplierId: string;
  autoProposals: boolean;
  /** Zapisany stopień; zachowanie stopni 2–4 przychodzi z kolejnymi wdrożeniami (TASKS 6/8/9). */
  autoLevel: ZdAutoLevel;
  /** „HH:MM” — do której handlowcy dokładają do propozycji. */
  cutoffTime: string;
  updatedAt: string | null;
};

export function parseZdAutoLevel(v: unknown): ZdAutoLevel {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 4 ? (n as ZdAutoLevel) : 0;
}

/** „H:MM”, „HH:MM” lub „HH:MM:SS” (time z Postgresa) → „HH:MM”; inaczej null. */
export function parseZdCutoffTime(v: unknown): string | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.exec(String(v ?? "").trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

function parseStrategy(v: unknown): ZdDemandStrategy {
  return v === "max30_90" ? "max30_90" : "classic";
}

function intOrNull(v: unknown, lo: number, hi: number): number | null {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}


/**
 * Brak wiersza = classic (jak dotąd). Brak tabeli (migracja 190 jeszcze niewgrana) też classic,
 * żeby wdrożenie kodu przed migracją nie zatrzymało Kreatora. Inny błąd bazy leci wyjątkiem —
 * silnik pokazuje „reguły niedostępne”.
 */
export async function fetchZdSupplierOrderPolicy(supplierId: string): Promise<ZdSupplierOrderPolicyRow> {
  const classic = {
    ...ZD_SUPPLIER_ORDER_POLICY_CLASSIC,
    supplierId,
    autoProposals: false,
    autoLevel: 0 as const,
    cutoffTime: ZD_DEFAULT_CUTOFF_TIME,
    updatedAt: null,
  };
  type Row = {
    strategy: string;
    target_days: number | null;
    cycle_days: number | null;
    auto_proposals: boolean;
    auto_level?: number;
    cutoff_time?: string;
    updated_at: Date | string;
  };
  const select = (extra: string) =>
    query<Row>(
      `SELECT strategy, target_days, cycle_days, auto_proposals${extra}, updated_at
         FROM zd_supplier_order_policy WHERE supplier_id = $1`,
      [supplierId]
    );
  let res;
  try {
    try {
      res = await select(", auto_level, cutoff_time::text AS cutoff_time");
    } catch (e) {
      // Kolumny z migracji 194 jeszcze niewgrane (42703) — reszta strategii działa jak dotąd.
      if ((e as { code?: unknown } | null)?.code !== "42703") throw e;
      res = await select("");
    }
  } catch (e) {
    if (isUndefinedTableError(e)) return classic;
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
    // Wiersz sprzed migracji 194 z włączonymi propozycjami to stopień 1.
    autoLevel: Math.max(parseZdAutoLevel(r.auto_level), r.auto_proposals === true ? 1 : 0) as ZdAutoLevel,
    cutoffTime: parseZdCutoffTime(r.cutoff_time) ?? ZD_DEFAULT_CUTOFF_TIME,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function upsertZdSupplierOrderPolicy(input: {
  supplierId: string;
  strategy: ZdDemandStrategy;
  targetDays: number | null;
  cycleDays: number | null;
  autoProposals: boolean;
  autoLevel: ZdAutoLevel;
  cutoffTime: string;
  updatedBy: string | null;
}): Promise<ZdSupplierOrderPolicyRow> {
  await query(
    `INSERT INTO zd_supplier_order_policy
       (supplier_id, strategy, target_days, cycle_days, auto_proposals, auto_level, cutoff_time, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7::time, now(), $8)
     ON CONFLICT (supplier_id) DO UPDATE SET
       strategy = EXCLUDED.strategy, target_days = EXCLUDED.target_days, cycle_days = EXCLUDED.cycle_days,
       auto_proposals = EXCLUDED.auto_proposals, auto_level = EXCLUDED.auto_level, cutoff_time = EXCLUDED.cutoff_time,
       updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [
      input.supplierId,
      parseStrategy(input.strategy),
      intOrNull(input.targetDays, 1, 180),
      intOrNull(input.cycleDays, 1, 60),
      input.autoProposals === true,
      parseZdAutoLevel(input.autoLevel),
      parseZdCutoffTime(input.cutoffTime) ?? ZD_DEFAULT_CUTOFF_TIME,
      input.updatedBy,
    ]
  );
  return fetchZdSupplierOrderPolicy(input.supplierId);
}

