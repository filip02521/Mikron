/**
 * Klasy ABC/XYZ i KPI automatu ZD jako krok nadrabiający w istniejącym cronie `stock-watch`
 * (bez osobnych zadań Windows — `install-cron.ps1` nie jest uruchamiany przy każdym wdrożeniu).
 * Klasy: raz w miesiącu kalendarzowym; KPI: raz na tydzień (pn–nd) po jego końcu.
 * Przebieg bez zapisu (błąd, Subiekt offline, pominięcie) = do zrobienia w kolejnym slocie / dniu.
 */
import { readCronRun, recordCronRun, type CronRunPayload } from "@/lib/services/cron-run-log";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { warsawCronContext } from "@/lib/time/warsaw-cron";
import { warsawNowParts } from "@/lib/time/warsaw";
import { runZdSkuClassSync } from "@/lib/data/zd-sku-class-sync";
import { runZdKpiWeekly, zdKpiWeekStart } from "@/lib/data/zd-kpi-weekly";

/**
 * Przebieg, który coś zapisał, zamyka okres — także z `ok: false` po częściowych błędach (pojedyncze towary /
 * dostawcy zostają ze starymi danymi, jak przy osobnym cronie). Inaczej jeden błędny towar powtarzałby
 * kilkunastominutowe przeliczenie codziennie do końca miesiąca.
 */
function doneDetail(run: CronRunPayload | null): Record<string, unknown> | null {
  const detail = run?.detail;
  if (!detail || detail.skipped === true) return null;
  return run.ok || (typeof detail.written === "number" && detail.written > 0) ? detail : null;
}

/** Klasy do przeliczenia: brak udanego przebiegu z tego miesiąca (yyyy-mm z `asOf`). */
export function zdSkuClassDue(last: CronRunPayload | null, todayKey: string): boolean {
  const asOf = doneDetail(last)?.asOf;
  return typeof asOf !== "string" || asOf.slice(0, 7) !== todayKey.slice(0, 7);
}

/** KPI do policzenia: brak udanego przebiegu za ostatni pełny tydzień. */
export function zdKpiWeeklyDue(last: CronRunPayload | null, todayKey: string): boolean {
  return doneDetail(last)?.weekStart !== zdKpiWeekStart(todayKey);
}

export type ZdAutomatCatchUpResult = {
  skuClass: "not_due" | "done" | "failed" | "already_running" | "subiekt_offline";
  kpiWeekly: "not_due" | "done" | "failed" | "already_running" | "subiekt_offline";
};

/** Klasy przed KPI — KPI braków A czyta świeże klasy. Zapis wyniku jak w trasach `/api/cron/zd-*`. */
export async function runZdAutomatCatchUp(): Promise<ZdAutomatCatchUpResult> {
  const out: ZdAutomatCatchUpResult = { skuClass: "not_due", kpiWeekly: "not_due" };
  const todayKey = warsawNowParts().dateKey;
  const [skuLast, kpiLast] = await Promise.all([readCronRun("zd_sku_class"), readCronRun("zd_kpi_weekly")]);
  const skuDue = zdSkuClassDue(skuLast, todayKey);
  const kpiDue = zdKpiWeeklyDue(kpiLast, todayKey);
  if (!skuDue && !kpiDue) return out;

  if (!(await isSubiektReachable({ force: true }))) {
    for (const job of [skuDue && "zd_sku_class", kpiDue && "zd_kpi_weekly"] as const) {
      if (!job) continue;
      await recordCronRun(job, {
        ok: false,
        detail: { subiektOffline: true, viaStockWatch: true, ...warsawCronContext() },
        error: "subiekt_offline",
      });
    }
    if (skuDue) out.skuClass = "subiekt_offline";
    if (kpiDue) out.kpiWeekly = "subiekt_offline";
    return out;
  }

  if (skuDue) {
    const r = await runZdSkuClassSync();
    if ("skipped" in r) out.skuClass = "already_running";
    else {
      const { ok, error, ...detail } = r;
      await recordCronRun("zd_sku_class", { ok, detail: { ...detail, viaStockWatch: true, ...warsawCronContext() }, error });
      out.skuClass = ok ? "done" : "failed";
    }
  }

  // Klasy liczą się jeszcze z wcześniejszego slotu — KPI na starych klasach zamknąłby tydzień; czekamy.
  if (kpiDue && out.skuClass === "already_running") out.kpiWeekly = "already_running";
  else if (kpiDue) {
    const r = await runZdKpiWeekly();
    if ("skipped" in r) out.kpiWeekly = "already_running";
    else {
      const { ok, error, ...detail } = r;
      await recordCronRun("zd_kpi_weekly", { ok, detail: { ...detail, viaStockWatch: true, ...warsawCronContext() }, error });
      out.kpiWeekly = ok ? "done" : "failed";
    }
  }
  return out;
}
