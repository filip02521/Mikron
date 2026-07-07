"use server";

// @service-role-ok — autoryzacja sprawdzana w warstwie aplikacji; service role dla operacji DB.

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { isAdmin, isSalesAccount } from "@/lib/auth-roles";
import { canAccessSalesPerson } from "@/lib/data/sales-group-access";
import {
  createDelegation,
  removeDelegation,
  fetchActiveDelegationsForDelegate,
  fetchDelegationsForSalesPerson,
  type VacationDelegationRow,
} from "@/lib/data/vacation-delegations";
import { createAdminClient } from "@/lib/supabase/admin";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function revalidateDelegationPaths() {
  revalidatePath("/moje");
  revalidatePath("/ustawienia");
  revalidatePath("/zespol");
  revalidatePath("/zespol/urlopy");
  revalidatePath("/zespol/handlowcy");
  revalidatePath("/admin/handlowcy");
}

/** Sprawdza czy użytkownik może zarządzać delegacjami danego handlowca. */
async function assertCanManageDelegations(
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>,
  salesPersonId: string
): Promise<void> {
  if (isAdmin(user.role)) return;

  // Właściciel konta handlowca
  if (isSalesAccount(user.role) && user.salesPersonId === salesPersonId) return;

  // Kierownik z dostępem do handlowca
  const allowed = await canAccessSalesPerson(user, salesPersonId);
  if (!allowed) {
    throw new Error("Brak uprawnień do zarządzania zastępstwami tego handlowca.");
  }
}

export async function actionSetVacationDelegation(input: {
  salesPersonId: string;
  delegateProfileId: string;
  startDate: string;
  endDate: string;
}): Promise<{ success: true } | { error: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Wymagane logowanie." };

    const salesPersonId = input.salesPersonId.trim();
    const delegateProfileId = input.delegateProfileId.trim();
    const startDate = input.startDate.trim();
    const endDate = input.endDate.trim();

    if (!salesPersonId || !delegateProfileId) {
      return { error: "Brak handlowca lub zastępcy." };
    }
    if (!startDate || !endDate) {
      return { error: "Podaj datę rozpoczęcia i zakończenia." };
    }
    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
      return { error: "Nieprawidłowy format daty." };
    }
    if (startDate > endDate) {
      return { error: "Data rozpoczęcia nie może być późniejsza niż data zakończenia." };
    }

    // Sprawdź czy użytkownik może zarządzać delegacjami tego handlowca
    await assertCanManageDelegations(user, salesPersonId);

    // Sprawdź czy zastępca ma konto sales lub sales_manager
    const supabase = createAdminClient();
    const { data: delegateProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", delegateProfileId)
      .maybeSingle();

    if (!delegateProfile) {
      return { error: "Nie znaleziono konta zastępcy." };
    }

    const delegateRole = delegateProfile.role as string;
    if (delegateRole !== "sales" && delegateRole !== "sales_manager") {
      return { error: "Zastępca musi mieć konto handlowca lub kierownika." };
    }

    // Nie można wyznaczyć siebie jako zastępcę
    if (delegateProfileId === user.id) {
      return { error: "Nie możesz wyznaczyć siebie jako zastępcę." };
    }

    // Nie można wyznaczyć samego zarządzanego handlowca jako zastępcę
    const { data: salesPersonProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("sales_person_id", salesPersonId)
      .maybeSingle();
    if (salesPersonProfile && salesPersonProfile.id === delegateProfileId) {
      return { error: "Nie można wyznaczyć tego samego handlowca jako zastępcę." };
    }

    await createDelegation({
      salesPersonId,
      delegateProfileId,
      startDate,
      endDate,
      createdBy: user.id,
    });

    revalidateDelegationPaths();
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się zapisać zastępstwa." };
  }
}

export async function actionRemoveVacationDelegation(
  id: string
): Promise<{ success: true } | { error: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Wymagane logowanie." };

    if (isAdmin(user.role)) {
      await removeDelegation(id);
      revalidateDelegationPaths();
      return { success: true };
    }

    // Pobierz delegację żeby sprawdzić uprawnienia
    const supabase = createAdminClient();
    const { data: delegation, error } = await supabase
      .from("sales_vacation_delegations")
      .select("sales_person_id")
      .eq("id", id)
      .maybeSingle();

    if (error || !delegation) {
      return { error: "Nie znaleziono zastępstwa." };
    }

    await assertCanManageDelegations(user, delegation.sales_person_id as string);
    await removeDelegation(id);
    revalidateDelegationPaths();
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się usunąć zastępstwa." };
  }
}

export async function actionFetchActiveDelegations(): Promise<VacationDelegationRow[]> {
  const user = await getSessionUser();
  if (!user) return [];
  return fetchActiveDelegationsForDelegate(user.id);
}

export async function actionFetchDelegationsForSalesPerson(
  salesPersonId: string
): Promise<VacationDelegationRow[]> {
  const user = await getSessionUser();
  if (!user) return [];

  try {
    await assertCanManageDelegations(user, salesPersonId);
  } catch {
    return [];
  }

  return fetchDelegationsForSalesPerson(salesPersonId);
}
