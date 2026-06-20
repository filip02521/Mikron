import type { SessionUser } from "@/lib/auth";
import {
  assertAdminNotInReadOnlyPanelPreview,
  assertAdminPanelAllowsProcurementBoardMutations,
} from "@/lib/auth/guard-admin-panel-preview";
import { canAccessSalesPerson } from "@/lib/data/sales-group-access";
import { canAccessOperations, isAdmin, isSales, isSalesManager } from "@/lib/auth-roles";

type OrderEntry = { salesPersonId?: string | null };

/** Guard składania prośb — role + preview panelu admina + scope kierownika. */
export async function assertCanSubmitIndividualOrders(
  user: SessionUser,
  entries: OrderEntry[]
): Promise<void> {
  if (
    !canAccessOperations(user.role) &&
    !isSales(user.role) &&
    !isSalesManager(user.role)
  ) {
    throw new Error("Brak uprawnień");
  }

  if (isSales(user.role) || isSalesManager(user.role)) {
    await assertAdminNotInReadOnlyPanelPreview(user);
  } else if (isAdmin(user.role)) {
    await assertAdminPanelAllowsProcurementBoardMutations(user);
  }

  if (isSalesManager(user.role)) {
    for (const entry of entries) {
      if (!entry.salesPersonId) {
        throw new Error("Wybierz handlowca, w imieniu którego składasz prośbę.");
      }
      const allowed = await canAccessSalesPerson(user, entry.salesPersonId);
      if (!allowed) {
        throw new Error(
          "Nie masz uprawnień do składania prośby dla tego handlowca. Kierownik może składać prośby dla siebie oraz dla osób z przypisanych grup zespołu — poproś administratora o przypisanie grup do Twojego konta."
        );
      }
    }
  }
}
