"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { replaceSalesManagerGroupsForProfile } from "@/lib/users/sales-manager-groups-db";

function revalidateManagerPaths() {
  revalidatePath("/admin/uzytkownicy", "page");
  revalidatePath("/zespol", "page");
  revalidatePath("/zespol/handlowcy", "page");
}

/** Przypisanie grup (Sklep/Biuro) do konta kierownika — tylko admin. */
export async function actionSetSalesManagerGroups(
  profileId: string,
  groupIds: string[]
): Promise<{ success: true } | { error: string }> {
  await requireAdmin();

  const pid = profileId?.trim();
  if (!pid) return { error: "Brak identyfikatora użytkownika." };

  const supabase = createAdminClient();
  const unique = [...new Set(groupIds.map((g) => g.trim()).filter(Boolean))];
  const err = await replaceSalesManagerGroupsForProfile(supabase, pid, unique);
  if (err) return { error: err };

  revalidateManagerPaths();
  return { success: true };
}
