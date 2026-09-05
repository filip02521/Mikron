"use server";

// @service-role-ok — autoryzacja requireAdminForMutation(); service role z pełnym scope po warstwie aplikacji.
import { revalidatePath } from "next/cache";
import { requireAdminForMutation } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAIL_CENTER_MODULE_SLUG } from "@/lib/admin-module-slugs";

export async function actionSetMailCenterModuleEnabledForUser(
  input: { userId: string; enabled: boolean }
): Promise<{ success: true } | { error: string }> {
  await requireAdminForMutation();

  const userId = input.userId.trim();
  const enabled = Boolean(input.enabled);

  const supabase = createAdminClient();

  if (!enabled) {
    const { error } = await supabase
      .from("user_admin_modules")
      .delete()
      .eq("user_id", userId)
      .eq("module_slug", MAIL_CENTER_MODULE_SLUG);

    if (error) return { error: error.message };
    revalidatePath("/admin/uzytkownicy", "page");
    return { success: true };
  }

  const { error } = await supabase
    .from("user_admin_modules")
    .upsert(
      {
        user_id: userId,
        module_slug: MAIL_CENTER_MODULE_SLUG,
        enabled: true,
      },
      { onConflict: "user_id,module_slug" }
    );

  if (error) return { error: error.message };
  revalidatePath("/admin/uzytkownicy", "page");
  return { success: true };
}

