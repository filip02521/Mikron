import type { ZkWatchLineCoverage, ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";

export function countZkLineCoverage(
  hints: Pick<ZkWatchOrderHints, "lineCoverageByKey">,
  coverage: ZkWatchLineCoverage
): number {
  return Object.values(hints.lineCoverageByKey).filter((value) => value === coverage).length;
}

export function formatZkProsbaCoverageSummary(
  hints: Pick<ZkWatchOrderHints, "lineCoverageByKey">
): string | null {
  const openCount = countZkLineCoverage(hints, "open");
  const partialCount = countZkLineCoverage(hints, "partial");
  const deliveredCount = countZkLineCoverage(hints, "delivered");

  const parts: string[] = [];
  if (openCount > 0) {
    parts.push(
      `${openCount} ${openCount === 1 ? "pozycja w prośbie w toku" : openCount < 5 ? "pozycje w prośbie w toku" : "pozycji w prośbie w toku"}`
    );
  }
  if (partialCount > 0) {
    parts.push(
      `${partialCount} ${partialCount === 1 ? "pozycja częściowo dostarczona" : partialCount < 5 ? "pozycje częściowo dostarczone" : "pozycji częściowo dostarczonych"}`
    );
  }
  if (deliveredCount > 0) {
    parts.push(
      `${deliveredCount} ${deliveredCount === 1 ? "pozycja dostarczona" : deliveredCount < 5 ? "pozycje dostarczone" : "pozycji dostarczonych"}`
    );
  }

  return parts.length ? parts.join(" · ") : null;
}
