import type { ZkWatchLineCoverage, ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import { polishPluralWord } from "@/lib/email/polish-plural";

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
      `${openCount} ${polishPluralWord(openCount, "pozycja w prośbie w toku", "pozycje w prośbie w toku", "pozycji w prośbie w toku")}`
    );
  }
  if (partialCount > 0) {
    parts.push(
      `${partialCount} ${polishPluralWord(partialCount, "pozycja częściowo dostarczona", "pozycje częściowo dostarczone", "pozycji częściowo dostarczonych")}`
    );
  }
  if (deliveredCount > 0) {
    parts.push(
      `${deliveredCount} ${polishPluralWord(deliveredCount, "pozycja dostarczona", "pozycje dostarczone", "pozycji dostarczonych")}`
    );
  }

  return parts.length ? parts.join(" · ") : null;
}
