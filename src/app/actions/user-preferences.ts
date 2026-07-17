"use server";

// @user-jwt-ok — mutacja własnego profilu; RLS profiles UPDATE dla auth.uid().

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function actionSetUniformBackground(
  enabled: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, error: "Brak sesji." };
  }

  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();

  if (fetchError || !current) {
    return { ok: false, error: fetchError?.message ?? "Nie znaleziono profilu." };
  }

  const existingPrefs =
    current.preferences && typeof current.preferences === "object"
      ? (current.preferences as Record<string, unknown>)
      : {};

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      preferences: { ...existingPrefs, uniform_background: enabled },
    })
    .eq("id", user.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
