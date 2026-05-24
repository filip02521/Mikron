import type { SupabaseClient } from "@supabase/supabase-js";
import type { IndividualOrder } from "@/types/database";

export type ResolvedSalesPersonContact = {
  personId: string;
  email: string;
  name: string;
};

/** E-mail handlowca — join + zapasowe odczytanie z sales_people (jak przy ręcznym zapisie w kolejce). */
export async function resolveSalesPersonEmail(
  supabase: SupabaseClient,
  order: Pick<IndividualOrder, "sales_person_id" | "sales_person">
): Promise<ResolvedSalesPersonContact | null> {
  const personId = order.sales_person_id;
  if (!personId) return null;

  let email = order.sales_person?.email?.trim();
  let name = order.sales_person?.name?.trim() ?? "Handlowiec";

  if (!email) {
    const { data: sp } = await supabase
      .from("sales_people")
      .select("email, name")
      .eq("id", personId)
      .maybeSingle();
    email = sp?.email?.trim();
    if (sp?.name?.trim()) name = sp.name.trim();
  }

  if (!email) return null;
  return { personId, email, name };
}
