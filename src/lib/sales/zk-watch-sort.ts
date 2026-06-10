import { isFollowUpDue, followUpTimestamp } from "@/lib/sales/notepad-follow-up";
import { parseZkNumberSortParts } from "@/lib/subiekt/zk-document";
import { formatZkMonthLabel } from "@/lib/subiekt/zk-search";
import type { SalesZkWatch } from "@/types/database";

type ZkWatchSortable = Pick<
  SalesZkWatch,
  "zk_number" | "zk_issued_at" | "created_at" | "follow_up_at"
>;

function monthParts(watch: ZkWatchSortable) {
  return parseZkNumberSortParts(
    watch.zk_number,
    watch.zk_issued_at ?? watch.created_at
  );
}

/** Porównanie ZK: miesiąc rosnąco, numer seryjny rosnąco, potem przypomnienia. */
export function compareZkWatches(
  a: ZkWatchSortable,
  b: ZkWatchSortable,
  referenceMs?: number
): number {
  const monthA = monthParts(a);
  const monthB = monthParts(b);
  if (monthA.sortKey !== monthB.sortKey) {
    return monthA.sortKey.localeCompare(monthB.sortKey);
  }

  if (monthA.serial !== monthB.serial) return monthA.serial - monthB.serial;

  const followUpDueA = isFollowUpDue(a.follow_up_at, referenceMs);
  const followUpDueB = isFollowUpDue(b.follow_up_at, referenceMs);
  if (followUpDueA !== followUpDueB) return followUpDueA ? -1 : 1;

  const followA = followUpTimestamp(a.follow_up_at);
  const followB = followUpTimestamp(b.follow_up_at);
  if (followA != null && followB != null && followA !== followB) return followA - followB;
  if (followA != null && followB == null) return -1;
  if (followA == null && followB != null) return 1;

  const byNumber = a.zk_number.localeCompare(b.zk_number, "pl");
  if (byNumber !== 0) return byNumber;

  return a.created_at.localeCompare(b.created_at);
}

/** Grupuje ZK po miesiącu z numeru (lub dacie wystawienia), wewnątrz miesiąca po numerze. */
export function sortZkWatches(
  watches: SalesZkWatch[],
  referenceMs?: number
): SalesZkWatch[] {
  return [...watches].sort((a, b) => compareZkWatches(a, b, referenceMs));
}

export type ZkWatchMonthGroup = {
  key: string;
  label: string;
  watches: SalesZkWatch[];
};

export function groupZkWatchesByMonth(
  watches: SalesZkWatch[],
  referenceMs?: number
): ZkWatchMonthGroup[] {
  const sorted = sortZkWatches(watches, referenceMs);
  const groups: ZkWatchMonthGroup[] = [];

  for (const watch of sorted) {
    const parts = monthParts(watch);
    const label =
      parts.sortKey === "0000-00"
        ? "Inne numery"
        : formatZkMonthLabel(parts.year, parts.month);

    const last = groups[groups.length - 1];
    if (last?.key === parts.sortKey) {
      last.watches.push(watch);
    } else {
      groups.push({ key: parts.sortKey, label, watches: [watch] });
    }
  }

  return groups;
}
