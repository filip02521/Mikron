"use server";

// @service-role-ok — autoryzacja require*(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { getSessionUser, requireAdminForMutation } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isSalesAccount } from "@/lib/auth-roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSalesBugReportPagePath } from "@/lib/security/app-page-path";
import type { SalesBugReport, SalesBugReportStatus } from "@/types/database";

async function salesReporterForAction() {
  const user = await getSessionUser();
  if (!user) throw new Error("Wymagane logowanie");
  if (!isSalesAccount(user.role)) {
    throw new Error("Tylko handlowiec może wysłać zgłoszenie.");
  }
  const salesPerson = await resolveSalesPersonForUser(user);
  if (!salesPerson) {
    throw new Error("Konto nie jest powiązane z kartą handlowca.");
  }
  return { user, salesPerson };
}

function revalidateBugReports() {
  revalidatePath("/admin/zgloszenia");
  revalidatePath("/", "layout");
}

export async function actionSubmitSalesBugReport(input: {
  message: string;
  pagePath: string;
  userAgent?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const message = input.message.trim();
  if (message.length < 8) {
    return { ok: false, error: "Opisz problem w co najmniej kilku słowach." };
  }
  if (message.length > 4000) {
    return { ok: false, error: "Wiadomość jest za długa (max 4000 znaków)." };
  }

  try {
    const { user, salesPerson } = await salesReporterForAction();
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await supabase.from("sales_bug_reports").insert({
      profile_id: user.id,
      sales_person_id: salesPerson.id,
      reporter_name: salesPerson.name,
      reporter_email: user.email ?? null,
      page_path: normalizeSalesBugReportPagePath(input.pagePath),
      message,
      user_agent: input.userAgent?.trim().slice(0, 500) ?? null,
      status: "open",
      updated_at: now,
    });
    if (error) throw new Error(error.message);
    revalidateBugReports();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Nie udało się wysłać zgłoszenia.",
    };
  }
}

export async function actionUpdateSalesBugReport(input: {
  id: string;
  status: SalesBugReportStatus;
  adminNote?: string | null;
}): Promise<{ ok: true; report: SalesBugReport } | { ok: false; error: string }> {
  try {
    await requireAdminForMutation();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Brak uprawnień.",
    };
  }

  try {
    const supabase = createAdminClient();
    const bugReportId = input.id.trim();
    const { data, error } = await supabase
      .from("sales_bug_reports")
      .update({
        status: input.status,
        admin_note: input.adminNote?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bugReportId)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Nie znaleziono zgłoszenia.");
    revalidateBugReports();
    return { ok: true, report: data as SalesBugReport };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Nie udało się zapisać.",
    };
  }
}
