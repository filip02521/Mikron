"use server";

// @user-jwt-ok — mutacja własnego profilu; RLS profiles UPDATE dla auth.uid().

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { isSalesAccount } from "@/lib/auth-roles";
import { createClient } from "@/lib/supabase/server";

export async function completeSalesOnboarding(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !isSalesAccount(user.role)) {
    return { ok: false, error: "Brak uprawnień." };
  }
  if (!user.salesPersonId) {
    return { ok: false, error: "Konto nie jest powiązane z profilem handlowca." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ sales_onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
