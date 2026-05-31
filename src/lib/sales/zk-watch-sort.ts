import { isFollowUpDue, followUpTimestamp } from "@/lib/sales/notepad-follow-up";
import type { SalesZkWatch } from "@/types/database";

/** Najpierw przypomnienia na dziś/wcześniej, potem po dacie przypomnienia, na końcu po dacie dodania. */
export function sortZkWatches(
  watches: SalesZkWatch[],
  referenceMs?: number
): SalesZkWatch[] {
  return [...watches].sort((a, b) => {
    const followUpDueA = isFollowUpDue(a.follow_up_at, referenceMs);
    const followUpDueB = isFollowUpDue(b.follow_up_at, referenceMs);
    if (followUpDueA !== followUpDueB) return followUpDueA ? -1 : 1;

    const followA = followUpTimestamp(a.follow_up_at);
    const followB = followUpTimestamp(b.follow_up_at);
    if (followA != null && followB != null && followA !== followB) return followA - followB;
    if (followA != null && followB == null) return -1;
    if (followA == null && followB != null) return 1;

    return a.created_at.localeCompare(b.created_at);
  });
}
