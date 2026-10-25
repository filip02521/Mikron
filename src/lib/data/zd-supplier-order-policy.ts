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
}): Promise<{ policy: ZdSupplierOrderPolicyRow; warning: string | null }> {
  const autoLevel = parseZdAutoLevel(input.autoLevel);
  const cutoffTime = parseZdCutoffTime(input.cutoffTime) ?? ZD_DEFAULT_CUTOFF_TIME;
  const base = [
    input.supplierId,
    parseStrategy(input.strategy),
    intOrNull(input.targetDays, 1, 180),
    intOrNull(input.cycleDays, 1, 60),
    input.autoProposals === true,
    input.updatedBy,
  ];
  let warning: string | null = null;
  try {
    await query(
      `INSERT INTO zd_supplier_order_policy
         (supplier_id, strategy, target_days, cycle_days, auto_proposals, updated_by, auto_level, cutoff_time, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::time, now())
       ON CONFLICT (supplier_id) DO UPDATE SET
         strategy = EXCLUDED.strategy, target_days = EXCLUDED.target_days, cycle_days = EXCLUDED.cycle_days,
         auto_proposals = EXCLUDED.auto_proposals, auto_level = EXCLUDED.auto_level, cutoff_time = EXCLUDED.cutoff_time,
         updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [...base, autoLevel, cutoffTime]
    );
  } catch (e) {
    // Kod przed migracją 194 (wgrywana ręcznie z panelu): strategia zapisuje się jak dotąd, stopień 1 niesie auto_proposals.
    if ((e as { code?: unknown } | null)?.code !== "42703") throw e;
    await query(
      `INSERT INTO zd_supplier_order_policy (supplier_id, strategy, target_days, cycle_days, auto_proposals, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (supplier_id) DO UPDATE SET
         strategy = EXCLUDED.strategy, target_days = EXCLUDED.target_days, cycle_days = EXCLUDED.cycle_days,
         auto_proposals = EXCLUDED.auto_proposals, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      base
    );
    if (autoLevel > 1 || cutoffTime !== ZD_DEFAULT_CUTOFF_TIME) {
      warning = "Zapisano bez stopnia automatu i godziny odcięcia - baza nie ma jeszcze migracji 194_zd_automat_pl.sql (Admin → Migracje).";
    }
  }
  return { policy: await fetchZdSupplierOrderPolicy(input.supplierId), warning };
}


/** Ustawienia automatu do pokazania obok cyklu z karty (karta dostawcy, Terminy zamówień). */
export type ZdAutomatPolicySummary = Pick<ZdSupplierOrderPolicyRow, "strategy" | "targetDays" | "cycleDays" | "autoProposals">;

/** Dostawcy w automacie (strategia ≠ jak dotąd): supplier_id → ustawienia. Brak tabeli (migracja 190) → pusto. */
export async function fetchZdAutomatPolicySummaries(): Promise<Record<string, ZdAutomatPolicySummary>> {
  try {
    const res = await query<{ supplier_id: string; strategy: string; target_days: number | null; cycle_days: number | null; auto_proposals: boolean }>(
      `SELECT supplier_id, strategy, target_days, cycle_days, auto_proposals
         FROM zd_supplier_order_policy WHERE strategy <> 'classic'`
    );
    return Object.fromEntries(
      res.rows.map((r) => [
        r.supplier_id,
        {
          strategy: r.strategy as ZdDemandStrategy,
          targetDays: r.target_days == null ? null : Number(r.target_days),
          cycleDays: r.cycle_days == null ? null : Number(r.cycle_days),
          autoProposals: r.auto_proposals === true,
        },
      ])
    );
  } catch (e) {
    if (isUndefinedTableError(e)) return {};
    throw e;
  }
}

/**
 * Wynik próby propozycji automatu (nocny przebieg, „Przygotuj teraz”) — panel dzienny pokazuje, czemu dziś nic
 * nie powstało. Tylko dostawcy w automacie (wiersz z polityką ≠ classic). Baza bez migracji 197 → bez zapisu.
 * Błąd zapisu nie przerywa przebiegu (log).
 */
export async function recordZdAutomatAttempt(
  supplierId: string,
  outcome: { kind: "created" | "nothing_to_order" | "not_due" | "disabled" | "skipped" | "error"; detail?: string | null }
): Promise<void> {
  try {
    await query(
      `UPDATE zd_supplier_order_policy
          SET last_attempt_at = now(), last_attempt_kind = $2, last_attempt_detail = $3
        WHERE supplier_id = $1 AND strategy <> 'classic'`,
      [supplierId, outcome.kind, outcome.detail?.trim().slice(0, 500) || null]
    );
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (isUndefinedTableError(e) || code === "42703") return;
    console.error("[automat ZD] zapis wyniku próby", supplierId, e);
  }
}
