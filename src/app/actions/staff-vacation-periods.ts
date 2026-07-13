"use server";

// @service-role-ok — autoryzacja sprawdzana w warstwie aplikacji; service role dla operacji DB.

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-roles";
import {
  createStaffVacationPeriod,
  removeStaffVacationPeriod,
} from "@/lib/data/staff-vacation-periods";
import { createAdminClient } from "@/lib/supabase/admin";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function revalidateStaffVacationPaths() {
  revalidatePath("/urlopy");
}

export async function actionSetStaffVacationPeriod(input: {
  userId: string;
  startDate: string;
  endDate: string;
  note?: string | null;
}): Promise<{ success: true } | { error: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Wymagane logowanie." };

    const userId = input.userId.trim();
    const startDate = input.startDate.trim();
    const endDate = input.endDate.trim();
    const note = input.note?.trim().slice(0, 500) || null;

    if (!userId) return { error: "Brak użytkownika." };
    if (!startDate || !endDate) return { error: "Podaj datę rozpoczęcia i zakończenia." };
    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
      return { error: "Nieprawidłowy format daty." };
    }
    if (startDate > endDate) {
      return { error: "Data rozpoczęcia nie może być późniejsza niż data zakończenia." };
    }

    if (!isAdmin(user.role) && user.id !== userId) {
      return { error: "Możesz zarządzać tylko własnymi urlopami." };
    }

    await createStaffVacationPeriod({ userId, startDate, endDate, note });
    revalidateStaffVacationPaths();
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się zapisać urlopu." };
  }
}

export async function actionRemoveStaffVacationPeriod(
  id: string
): Promise<{ success: true } | { error: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Wymagane logowanie." };

    if (isAdmin(user.role)) {
      await removeStaffVacationPeriod(id);
      revalidateStaffVacationPaths();
      return { success: true };
    }

    const supabase = createAdminClient();
    const { data: period, error } = await supabase
      .from("staff_vacation_periods")
      .select("user_id")
      .eq("id", id)
      .maybeSingle();

    if (error || !period) return { error: "Nie znaleziono urlopu." };
    if (period.user_id !== user.id) {
      return { error: "Możesz usuwać tylko własne urlopy." };
    }

    await removeStaffVacationPeriod(id);
    revalidateStaffVacationPaths();
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się usunąć urlopu." };
  }
}
