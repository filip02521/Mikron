import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { canAccessOperations, canAccessWarehouse, isSalesAccount } from "@/lib/auth-roles";
import {
  countVerificationOrders,
  fetchIndividualOrders,
  countDeliveryQueue,
  fetchSuppliersWithSchedules,
} from "@/lib/data/queries";
import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";
import { countDailyPanelNavBadge } from "@/lib/orders/procurement-daily-ui";
import { computeSalesActivityVersion } from "@/lib/orders/sales-activity-version";
import { countSalesNavAttention } from "@/lib/orders/sales-nav-attention";
import { countActivePaymentWatches } from "@/lib/data/sales-notepad";
import { AppShellClient } from "./AppShellClient";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  const role = session?.role ?? null;
  let navBadges: {
    nowe: number;
    weryfikacja: number;
    realizacja: number;
    salesMoje?: number;
    salesNotatnik?: number;
  } = { nowe: 0, weryfikacja: 0, realizacja: 0 };
  let salesActivityVersion: string | null = null;

  if (role && canAccessWarehouse(role)) {
    try {
      const realizacjaCount = await countDeliveryQueue();
      if (canAccessOperations(role)) {
        const [schedules, newOrders, weryfikacja] = await Promise.all([
          fetchSuppliersWithSchedules(),
          fetchIndividualOrders({ status: "Nowe", hideSalesAcknowledged: false }),
          countVerificationOrders(),
        ]);
        const workspace = buildSummaryWorkspace(
          schedules,
          newOrders.filter((o) => o.status === "Nowe")
        );
        navBadges = {
          nowe: countDailyPanelNavBadge(workspace),
          weryfikacja,
          realizacja: realizacjaCount,
        };
      } else {
        navBadges = { nowe: 0, weryfikacja: 0, realizacja: realizacjaCount };
      }
    } catch {
      navBadges = { nowe: 0, weryfikacja: 0, realizacja: 0 };
    }
  }

  if (role && isSalesAccount(role) && session) {
    try {
      const salesPerson = await resolveSalesPersonForUser(session);
      if (salesPerson) {
        const [version, attention, notatnikCount] = await Promise.all([
          computeSalesActivityVersion(salesPerson.id),
          countSalesNavAttention(salesPerson.id),
          countActivePaymentWatches(salesPerson.id).catch(() => 0),
        ]);
        salesActivityVersion = version;
        navBadges = {
          ...navBadges,
          salesMoje: attention,
          salesNotatnik: notatnikCount,
        };
      }
    } catch {
      salesActivityVersion = null;
    }
  }

  return (
    <AppShellClient
      role={role}
      userEmail={session?.email ?? null}
      showLoginLink={!role}
      navBadges={navBadges}
      salesActivityVersion={salesActivityVersion}
    >
      {children}
    </AppShellClient>
  );
}
