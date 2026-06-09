import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { INFORMACJA_FLOW_DIRECT } from "@/lib/orders/informacja-flow-copy";

/** Etykieta przy wierszu prośby informacyjnej w /moje. */
export const MY_ORDER_INFORMACJA_KIND_BADGE = "Informacyjna" as const;

export const MY_ORDER_INFORMACJA_KIND_BADGE_TITLE = INFORMACJA_FLOW_DIRECT.label;

export function shouldShowMyOrderKindBadge(row: Pick<MyOrderRow, "kind">): boolean {
  return row.kind === "informacja";
}

export const myOrderInformacjaKindBadgeClass =
  "shrink-0 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-violet-900 ring-1 ring-inset ring-violet-200/90";
