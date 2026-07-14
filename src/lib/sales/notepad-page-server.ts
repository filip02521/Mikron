import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { resolvePreviewSalesPerson, resolveDelegatePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";
import { getAppRole } from "@/lib/auth-dev";
import { logDevPageError } from "@/lib/dev/log-page-error";
import { isAdmin, isSalesAccount, isSalesManager } from "@/lib/auth-roles";
import type { UserRole } from "@/types/database";
import type { VacationDelegationRow } from "@/lib/data/vacation-delegations";

export type SalesNotepadPageAccess = {
  role: UserRole | null;
  salesPersonId: string | null;
  salesPersonName: string | null;
  linkError: string | null;
  isTeamPreview: boolean;
  isDelegatePreview: boolean;
  previewSalesPersonId: string | null;
  delegationStartDate: string | null;
  delegationEndDate: string | null;
  activeDelegations: VacationDelegationRow[];
};

/** Wspólna autoryzacja i podgląd handlowca dla /zk oraz /notatnik. */
export async function resolveSalesNotepadPageAccess(input: {
  previewSalesPersonId?: string | null;
}): Promise<SalesNotepadPageAccess> {
  const previewSalesPersonId = input.previewSalesPersonId?.trim() || null;
  const role = await getAppRole();
  let salesPersonId: string | null = null;
  let salesPersonName: string | null = null;
  let ownSalesPersonId: string | null = null;
  let linkError: string | null = null;
  let isTeamPreview = false;
  let isDelegatePreview = false;
  let delegationStartDate: string | null = null;
  let delegationEndDate: string | null = null;
  let activeDelegations: VacationDelegationRow[] = [];

  try {
    const user = await getSessionUser();
    if (user && isAdmin(user.role) && previewSalesPersonId) {
      const preview = await resolvePreviewSalesPerson(previewSalesPersonId, user);
      if (preview) {
        salesPersonId = preview.id;
        salesPersonName = preview.name;
        isTeamPreview = true;
      } else {
        linkError = "Nie znaleziono handlowca do podglądu.";
      }
    } else if (user && isSalesAccount(user.role)) {
      const own = await resolveSalesPersonForUser(user);
      ownSalesPersonId = own?.id ?? null;
      if (isSalesManager(user.role) && previewSalesPersonId) {
        const preview = await resolvePreviewSalesPerson(previewSalesPersonId, user);
        if (preview) {
          salesPersonId = preview.id;
          salesPersonName = preview.name;
          try {
            const { fetchActiveDelegationsForDelegate } = await import("@/lib/data/vacation-delegations");
            activeDelegations = await fetchActiveDelegationsForDelegate(user.id);
          } catch {}
          // Sprawdź czy kierownik jest aktywnym zastępcą dla tego handlowca
          try {
            const { isProfileActiveDelegateForSalesPerson } = await import("@/lib/data/vacation-delegations");
            const isDelegate = await isProfileActiveDelegateForSalesPerson(user.id, preview.id);
            if (isDelegate && preview.id !== ownSalesPersonId) {
              isDelegatePreview = true;
              const match = activeDelegations.find((d) => d.salesPersonId === preview.id);
              if (match) {
                delegationStartDate = match.startDate;
                delegationEndDate = match.endDate;
              }
            } else {
              isTeamPreview = preview.id !== ownSalesPersonId;
            }
          } catch {
            isTeamPreview = preview.id !== ownSalesPersonId;
          }
        } else {
          linkError = "Nie znaleziono handlowca do podglądu.";
        }
      } else {
        salesPersonId = own?.id ?? null;
        salesPersonName = own?.name ?? null;
        if (
          user.role === "sales" ||
          user.role === "sales_manager"
        ) {
          try {
            const { fetchActiveDelegationsForDelegate } = await import("@/lib/data/vacation-delegations");
            activeDelegations = await fetchActiveDelegationsForDelegate(user.id);
          } catch {}
        }

        if (
          user.role === "sales" &&
          previewSalesPersonId &&
          previewSalesPersonId !== ownSalesPersonId
        ) {
          const delegatePreview = await resolveDelegatePreviewSalesPerson(
            previewSalesPersonId,
            user
          );
          if (delegatePreview) {
            salesPersonId = delegatePreview.id;
            salesPersonName = delegatePreview.name;
            isDelegatePreview = true;
            try {
              const { fetchActiveDelegationsForDelegate } = await import("@/lib/data/vacation-delegations");
              const delegations = await fetchActiveDelegationsForDelegate(user.id);
              const match = delegations.find((d) => d.salesPersonId === delegatePreview.id);
              if (match) {
                delegationStartDate = match.startDate;
                delegationEndDate = match.endDate;
              }
            } catch {}
          } else {
            linkError = "Możesz przeglądać tylko własne dane handlowca — parametr ?dla= został zignorowany.";
          }
        }
      }

      if (!ownSalesPersonId && user.role === "sales") {
        linkError =
          "Twoje konto nie jest przypisane do profilu handlowca. Poproś administratora o link zaproszenia (Admin → Handlowcy).";
      }
      if (!ownSalesPersonId && user.role === "sales_manager") {
        linkError =
          "Twoje konto kierownika nie jest przypisane do profilu handlowca — poproś administratora o przypisanie w sekcji Użytkownicy.";
      }
    }
  } catch (error) {
    logDevPageError("sales/notepad-page-server", error);
  }

  return {
    role,
    salesPersonId,
    salesPersonName,
    linkError,
    isTeamPreview,
    isDelegatePreview,
    previewSalesPersonId,
    delegationStartDate,
    delegationEndDate,
    activeDelegations,
  };
}

export function shouldRedirectNotatnikRouteToZk(input: {
  tab?: string | null;
  focusWatch?: string | null;
}): boolean {
  const tab = input.tab?.trim();
  const focus = input.focusWatch?.trim();
  if (focus) return true;
  return tab === "zk";
}

export function buildZkRouteRedirectUrl(input: {
  searchParams: Record<string, string | undefined>;
  focusWatch?: string | null;
}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input.searchParams)) {
    if (!value?.trim() || key === "tab" || key === "focusWatch") continue;
    params.set(key, value.trim());
  }
  const focus = input.focusWatch?.trim();
  if (focus) params.set("focusWatch", focus);
  const tab = input.searchParams.tab?.trim();
  if (tab === "archive") params.set("tab", "archive");
  const qs = params.toString();
  const hash = focus ? `#watch-${focus}` : "";
  return qs ? `/zk?${qs}${hash}` : `/zk${hash}`;
}

export function shouldRedirectZkRouteToNotatnik(tab?: string | null): boolean {
  return tab?.trim() === "notes";
}

export function buildNotatnikRouteRedirectUrl(input: {
  tab?: string | null;
  searchParams: Record<string, string | undefined>;
}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input.searchParams)) {
    if (!value?.trim() || key === "tab" || key === "focusWatch") continue;
    params.set(key, value.trim());
  }
  const tab = input.tab?.trim();
  if (tab === "archive") params.set("tab", "archive");
  const qs = params.toString();
  return qs ? `/notatnik?${qs}` : "/notatnik";
}
