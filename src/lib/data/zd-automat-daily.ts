/**
 * Dane sekcji „Automat ZD” panelu dziennego: dostawcy w automacie (polityka ≠ classic), ich ostatnie propozycje,
 * wynik ostatniej próby i dzisiejszy nocny przebieg. Tylko serwer.
 */
import { isUndefinedTableError, query } from "@/lib/db/pool";
import { SUBIEKT_DOC_TYPE_ZD } from "@/lib/orders/subiekt-lead-times";
import type {
  ZdAutomatDailyAttemptKind,
  ZdAutomatDailyData,
  ZdAutomatDailyProposalStatus,
  ZdAutomatDailySupplier,
} from "@/lib/orders/zd-automat-daily";
import { getLatestStockWatchRun } from "@/lib/stock-watch/data";

/** Ile ostatnich propozycji na dostawcę (kreski „Ostatnie cykle”). */
export const ZD_AUTOMAT_DAILY_HISTORY = 8;

const ATTEMPT_KINDS: ReadonlySet<string> = new Set(["created", "nothing_to_order", "not_due", "disabled", "skipped", "error"]);
const STATUSES: ReadonlySet<string> = new Set(["pending", "accepted", "rejected", "expired", "deferred"]);

export async function loadZdAutomatDaily(): Promise<ZdAutomatDailyData> {
  try {
    const sup = await query<{ id: string; name: string; is_active: boolean; has_scope: boolean; policy: Record<string, unknown> }>(
      // to_jsonb: kolumny z migracji 197 (ostatnia próba) czytają się także na bazie bez niej (wtedy null).
      `SELECT s.id, s.name, s.is_active,
              EXISTS (SELECT 1 FROM zd_estimate_supplier_scopes z WHERE z.supplier_id = s.id) AS has_scope,
              to_jsonb(p.*) AS policy
         FROM zd_supplier_order_policy p
         JOIN suppliers s ON s.id = p.supplier_id
        WHERE p.strategy <> 'classic'
        ORDER BY s.name`
    );
    if (!sup.rows.length) return { suppliers: [], run: null };
    const ids = sup.rows.map((r) => r.id);
    const [props, run] = await Promise.all([
      query<{
        supplier_id: string;
        id: string;
        created_at: Date | string;
        status: string;
        line_count: number;
        value_net: string | number;
        dok_nr: string | null;
      }>(
        `SELECT x.supplier_id, x.id, x.created_at, x.status, x.line_count, x.value_net, d.nr_pelny AS dok_nr
           FROM (SELECT supplier_id, id, created_at, status, line_count, value_net, dok_id,
                        row_number() OVER (PARTITION BY supplier_id ORDER BY created_at DESC) AS rn
                   FROM zd_auto_proposals WHERE supplier_id = ANY($1::uuid[])) x
           LEFT JOIN subiekt_purchase_docs d ON d.dok_id = x.dok_id AND d.typ = $3
          WHERE x.rn <= $2
          ORDER BY x.supplier_id, x.created_at DESC`,
        [ids, ZD_AUTOMAT_DAILY_HISTORY, SUBIEKT_DOC_TYPE_ZD]
      ),
      getLatestStockWatchRun().catch(() => null),
    ]);
    const bySupplier = new Map<string, ZdAutomatDailySupplier["proposals"]>();
    for (const p of props.rows) {
      const list = bySupplier.get(p.supplier_id) ?? [];
      list.push({
        id: p.id,
        createdAt: new Date(p.created_at).toISOString(),
        status: (STATUSES.has(p.status) ? p.status : "expired") as ZdAutomatDailyProposalStatus,
        lineCount: Number(p.line_count) || 0,
        valueNet: Number(p.value_net) || 0,
        dokNr: p.dok_nr?.trim() || null,
      });
      bySupplier.set(p.supplier_id, list);
    }
    return {
      suppliers: sup.rows.map((r) => {
        const p = r.policy ?? {};
        const kind = typeof p.last_attempt_kind === "string" && ATTEMPT_KINDS.has(p.last_attempt_kind) ? p.last_attempt_kind : null;
        const cycle = p.cycle_days == null ? null : Number(p.cycle_days);
        return {
          id: r.id,
          name: r.name,
          isActive: r.is_active,
          hasScope: r.has_scope,
          autoProposals: p.auto_proposals === true,
          cycleDays: Number.isFinite(cycle) ? cycle : null,
          proposals: bySupplier.get(r.id) ?? [],
          lastAttempt:
            kind && p.last_attempt_at
              ? {
                  at: new Date(String(p.last_attempt_at)).toISOString(),
                  kind: kind as ZdAutomatDailyAttemptKind,
                  detail: typeof p.last_attempt_detail === "string" ? p.last_attempt_detail : null,
                }
              : null,
        };
      }),
      run: run
        ? { runDate: run.runDate, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt }
        : null,
    };
  } catch (e) {
    // Baza bez migracji 190 (automat) — sekcji nie ma.
    if (isUndefinedTableError(e)) return { suppliers: [], run: null };
    throw e;
  }
}
