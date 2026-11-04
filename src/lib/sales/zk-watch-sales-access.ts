import type { SessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isSalesManager } from "@/lib/auth-roles";
import { canAccessSalesPerson } from "@/lib/data/sales-group-access";
import { isProfileActiveDelegateForSalesPerson } from "@/lib/data/vacation-delegations";
import type { SalesZkWatch } from "@/types/database";

/**
 * Czy konto handlowca może tworzyć prośby z tego ZK: własne ZK, zastępstwo (także wskazane
 * jawnie przez `delegateFor`) albo zakres kierownika. Id ZK przychodzi od klienta.
 */
export async function canSalesUserActOnZkWatch(
  user: SessionUser,
  watch: Pick<SalesZkWatch, "sales_person_id">,
  delegateFor?: string | null
): Promise<boolean> {
  const own = await resolveSalesPersonForUser(user);
  if (own?.id === watch.sales_person_id) return true;
  if (await isProfileActiveDelegateForSalesPerson(user.id, watch.sales_person_id)) return true;
  const delegate = delegateFor?.trim();
  if (
    delegate === watch.sales_person_id &&
    (await isProfileActiveDelegateForSalesPerson(user.id, delegate))
  ) {
    return true;
  }
  return isSalesManager(user.role) && (await canAccessSalesPerson(user, watch.sales_person_id));
}
