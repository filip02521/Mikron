import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth";
import { isSalesAccount } from "@/lib/auth-roles";

export type ResolvedSalesPerson = {
  id: string;
  name: string;
};

/** Handlowiec z profilu lub dopasowany po e-mailu do karty w sales_people. */
export async function resolveSalesPersonForUser(
  user: SessionUser
): Promise<ResolvedSalesPerson | null> {
  if (!isSalesAccount(user.role) || !hasSupabaseConfig()) return null;

  const admin = createAdminClient();

  if (user.salesPersonId) {
    const { data } = await admin
      .from("sales_people")
      .select("id, name")
      .eq("id", user.salesPersonId)
      .maybeSingle();
    if (data) return { id: data.id, name: data.name };
  }

  const email = user.email?.trim().toLowerCase();
  if (!email) return null;

  const { data: match } = await admin
    .from("sales_people")
    .select("id, name")
    .ilike("email", email)
    .maybeSingle();

  if (match) return { id: match.id, name: match.name };

  return null;
}
