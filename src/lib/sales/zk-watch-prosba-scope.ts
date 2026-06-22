import {
  parseZkWatchLineChecks,
  type ZkWatchLineCheckStored,
  type ZkWatchLineView,
} from "@/lib/sales/zk-watch-lines";
import type { SalesZkWatch } from "@/types/database";

export function productLineViews(views: ZkWatchLineView[]): ZkWatchLineView[] {
  return views.filter((line) => line.key !== "summary");
}

/** Czy handlowiec ustalił już, które pozycje wymagają prośby. */
export function isZkWatchProsbaScopeConfigured(
  checks: ZkWatchLineCheckStored[],
  lineViews: ZkWatchLineView[]
): boolean {
  const productLines = productLineViews(lineViews);
  if (productLines.length === 0) return true;
  const byKey = new Map(checks.map((check) => [check.key, check]));
  return productLines.every((line) => byKey.get(line.key)?.needs_prosba !== undefined);
}

export function needsProsbaByKeyFromChecks(
  checks: ZkWatchLineCheckStored[]
): Map<string, boolean> {
  return new Map(
    checks
      .filter((check) => check.needs_prosba !== undefined)
      .map((check) => [check.key, check.needs_prosba === true])
  );
}

/** Klucze pozycji, które mogą trafić do prośby. null = zakres jeszcze nieustalony (legacy: wszystkie). */
export function getZkWatchProsbaScopeLineKeys(
  watch: Pick<SalesZkWatch, "line_checks">,
  lineViews: ZkWatchLineView[]
): string[] | null {
  const checks = parseZkWatchLineChecks(watch.line_checks);
  const productLines = productLineViews(lineViews);
  if (productLines.length === 0) return [];

  if (!isZkWatchProsbaScopeConfigured(checks, lineViews)) {
    return null;
  }

  const needsByKey = needsProsbaByKeyFromChecks(checks);
  return productLines.filter((line) => needsByKey.get(line.key) === true).map((line) => line.key);
}

/** Czy ZK ma zapisany zakres pozycji (przy dodawaniu lub edycji). */
export function hasZkWatchTrackedProsbaScope(
  watch: Pick<SalesZkWatch, "line_checks">
): boolean {
  return parseZkWatchLineChecks(watch.line_checks).some(
    (check) => check.needs_prosba !== undefined
  );
}

/**
 * Klucze pozycji objętych zapisanym zakresem (do zamówienia lub świadomie pominięte).
 * null = brak zakresu — pokazuj wszystkie pozycje z ZK.
 */
export function getZkWatchTrackedScopeLineKeys(
  watch: Pick<SalesZkWatch, "line_checks">,
  lineViews: ZkWatchLineView[]
): string[] | null {
  const needsByKey = needsProsbaByKeyFromChecks(parseZkWatchLineChecks(watch.line_checks));
  if (needsByKey.size === 0) return null;
  return productLineViews(lineViews)
    .filter((line) => needsByKey.has(line.key))
    .map((line) => line.key);
}

export function countZkWatchLinesOutsideTrackedScope(
  watch: Pick<SalesZkWatch, "line_checks">,
  lineViews: ZkWatchLineView[]
): number {
  const tracked = getZkWatchTrackedScopeLineKeys(watch, lineViews);
  if (tracked === null) return 0;
  const trackedSet = new Set(tracked);
  return productLineViews(lineViews).filter((line) => !trackedSet.has(line.key)).length;
}

/** Filtruje pozycje towarowe do widoku „wybrane” vs pełne ZK z Subiekta. */
export function filterZkWatchProductLineViewsForScope(
  lineViews: ZkWatchLineView[],
  watch: Pick<SalesZkWatch, "line_checks">,
  options: { showAllLines: boolean }
): ZkWatchLineView[] {
  const productLines = productLineViews(lineViews);
  if (options.showAllLines) return productLines;
  const tracked = getZkWatchTrackedScopeLineKeys(watch, lineViews);
  if (tracked === null) return productLines;
  const trackedSet = new Set(tracked);
  return productLines.filter((line) => trackedSet.has(line.key));
}

export function countZkWatchInStockLines(
  watch: Pick<SalesZkWatch, "line_checks">,
  lineViews: ZkWatchLineView[]
): number {
  const checks = parseZkWatchLineChecks(watch.line_checks);
  const productLines = productLineViews(lineViews);
  if (!isZkWatchProsbaScopeConfigured(checks, lineViews)) return 0;
  const needsByKey = needsProsbaByKeyFromChecks(checks);
  return productLines.filter((line) => needsByKey.get(line.key) === false).length;
}

export function mergeZkWatchLineChecksPreservingProsbaScope(
  views: ZkWatchLineView[],
  previousChecks: ZkWatchLineCheckStored[],
  patch: {
    arrivedByKey?: Map<string, boolean>;
    shelfMarkedByKey?: Map<string, boolean>;
    completedManuallyByKey?: Map<string, boolean>;
    needsProsbaByKey?: Map<string, boolean>;
  }
): ZkWatchLineCheckStored[] {
  const previousByKey = new Map(previousChecks.map((check) => [check.key, check]));

  return views.map((view) => {
    const previous = previousByKey.get(view.key);
    const arrived =
      patch.arrivedByKey?.get(view.key) ?? previous?.arrived ?? false;
    const shelfMarked =
      patch.shelfMarkedByKey?.get(view.key) ?? previous?.shelf_marked ?? false;
    const completedManually =
      patch.completedManuallyByKey?.get(view.key) ?? previous?.completed_manually ?? false;
    const needsProsba =
      patch.needsProsbaByKey?.get(view.key) ?? previous?.needs_prosba;

    return {
      key: view.key,
      arrived,
      ...(shelfMarked ? { shelf_marked: true } : {}),
      ...(completedManually ? { completed_manually: true } : {}),
      ...(needsProsba !== undefined ? { needs_prosba: needsProsba } : {}),
    };
  });
}

export function formatZkWatchProsbaScopeSummary(
  watch: Pick<SalesZkWatch, "line_checks">,
  lineViews: ZkWatchLineView[]
): string | null {
  const checks = parseZkWatchLineChecks(watch.line_checks);
  const productLines = productLineViews(lineViews);
  if (productLines.length === 0) return null;

  if (!isZkWatchProsbaScopeConfigured(checks, lineViews)) {
    return "Wybierz pozycje do zamówienia";
  }

  const needsByKey = needsProsbaByKeyFromChecks(checks);
  const toOrder = productLines.filter((line) => needsByKey.get(line.key) === true).length;
  const inStock = productLines.length - toOrder;

  if (toOrder === 0) return "Bez prośby — nic nie wybrane";
  if (inStock === 0) return toOrder === 1 ? "1 do zamówienia" : `${toOrder} do zamówienia`;
  return `${toOrder} do zamówienia · ${inStock} pominięte`;
}
