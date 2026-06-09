import {
  MY_ORDER_INFORMACJA_KIND_BADGE,
  MY_ORDER_INFORMACJA_KIND_BADGE_TITLE,
  myOrderInformacjaKindBadgeClass,
  shouldShowMyOrderKindBadge,
} from "@/lib/orders/my-order-kind-badge";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";

export function MyOrderKindBadge({ row }: { row: Pick<MyOrderRow, "kind"> }) {
  if (!shouldShowMyOrderKindBadge(row)) return null;

  return (
    <span className={myOrderInformacjaKindBadgeClass} title={MY_ORDER_INFORMACJA_KIND_BADGE_TITLE}>
      {MY_ORDER_INFORMACJA_KIND_BADGE}
    </span>
  );
}
