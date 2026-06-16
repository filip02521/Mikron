import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { resolvePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";
import { getAppRole } from "@/lib/auth-dev";
import { isAdmin, isSalesAccount, isSalesManager } from "@/lib/auth-roles";
import type { UserRole } from "@/types/database";

export type SalesNotepadPageAccess = {
  role: UserRole | null;
  salesPersonId: string | null;
  salesPersonName: string | null;
  linkError: string | null;
  isTeamPreview: boolean;
  previewSalesPersonId: string | null;
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
          isTeamPreview = preview.id !== ownSalesPersonId;
        } else {
          linkError = "Nie znaleziono handlowca do podglądu.";
        }
      } else {
        salesPersonId = own?.id ?? null;
        salesPersonName = own?.name ?? null;
        if (
          user.role === "sales" &&
          previewSalesPersonId &&
          previewSalesPersonId !== ownSalesPersonId
        ) {
          linkError = "Możesz przeglądać tylko własne dane handlowca — parametr ?dla= został zignorowany.";
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
  } catch {
    /* dev */
  }

  return {
    role,
    salesPersonId,
    salesPersonName,
    linkError,
    isTeamPreview,
    previewSalesPersonId,
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
