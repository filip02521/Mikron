"use server";

// @service-role-ok — autoryzacja sprawdzana w warstwie aplikacji; service role dla operacji DB.

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { isAdmin, isSalesAccount } from "@/lib/auth-roles";
import { canAccessSalesPerson } from "@/lib/data/sales-group-access";
import {
  createVacationPeriod,
  removeVacationPeriod,
  fetchVacationPeriodsForSalesPerson,
  type VacationPeriodRow,
} from "@/lib/data/sales-vacation-periods";
import { createAdminClient } from "@/lib/supabase/admin";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function revalidateVacationPaths() {
  revalidatePath("/moje");
  revalidatePath("/zespol");
  revalidatePath("/zespol/urlopy");
}

/** Sprawdza czy użytkownik może zarządzać urlopami danego handlowca. */
async function assertCanManageVacationPeriods(
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>,
  salesPersonId: string
): Promise<void> {
  if (isAdmin(user.role)) return;

  if (isSalesAccount(user.role) && user.salesPersonId === salesPersonId) return;

  const allowed = await canAccessSalesPerson(user, salesPersonId);
  if (!allowed) {
    throw new Error("Brak uprawnień do zarządzania urlopami tego handlowca.");
  }
}

export async function actionSetVacationPeriod(input: {
  salesPersonId: string;
  startDate: string;
  endDate: string;
  note?: string | null;
}): Promise<{ success: true } | { error: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Wymagane logowanie." };

    const salesPersonId = input.salesPersonId.trim();
    const startDate = input.startDate.trim();
    const endDate = input.endDate.trim();
    const note = input.note?.trim().slice(0, 500) || null;

    if (!salesPersonId) {
      return { error: "Brak handlowca." };
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

    await assertCanManageVacationPeriods(user, salesPersonId);

    await createVacationPeriod({ salesPersonId, startDate, endDate, note });

    revalidateVacationPaths();
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się zapisać urlopu." };
  }
}

export async function actionRemoveVacationPeriod(
  id: string
): Promise<{ success: true } | { error: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Wymagane logowanie." };

    if (isAdmin(user.role)) {
      await removeVacationPeriod(id);
      revalidateVacationPaths();
      return { success: true };
    }

    const supabase = createAdminClient();
    const { data: period, error } = await supabase
      .from("sales_vacation_periods")
      .select("sales_person_id")
      .eq("id", id)
      .maybeSingle();

    if (error || !period) {
      return { error: "Nie znaleziono urlopu." };
    }

    await assertCanManageVacationPeriods(user, period.sales_person_id as string);
    await removeVacationPeriod(id);
    revalidateVacationPaths();
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się usunąć urlopu." };
  }
}

export async function actionFetchVacationPeriods(
  salesPersonId: string
): Promise<VacationPeriodRow[]> {
  const user = await getSessionUser();
  if (!user) return [];

  try {
    await assertCanManageVacationPeriods(user, salesPersonId);
  } catch {
    return [];
  }

  return fetchVacationPeriodsForSalesPerson(salesPersonId);
}
