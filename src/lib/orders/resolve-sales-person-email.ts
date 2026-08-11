import type { SupabaseClient } from "@supabase/supabase-js";
import type { IndividualOrder } from "@/types/database";

export type ResolvedSalesPersonContact = {
  personId: string;
  email: string;
  name: string;
};

/**
 * E-mail do powiadomień handlowca.
 * Preferuje e-mail powiązanego konta (`profiles`), bo to adres z panelu Użytkownicy;
 * karta `sales_people.email` bywa nieaktualna po zmianie powiązania.
 */
async function resolveEmailForSalesPersonId(
  supabase: SupabaseClient,
  personId: string,
  cardEmail: string | null | undefined
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("sales_person_id", personId)
    .maybeSingle();

  const fromProfile = profile?.email?.trim();
  if (fromProfile) return fromProfile;

  const fromCard = cardEmail?.trim();
  return fromCard || null;
}

/** E-mail handlowca — join + zapasowe odczytanie z sales_people (jak przy ręcznym zapisie w kolejce). */
export async function resolveSalesPersonEmail(
  supabase: SupabaseClient,
  order: Pick<IndividualOrder, "sales_person_id" | "sales_person">
): Promise<ResolvedSalesPersonContact | null> {
  const personId = order.sales_person_id;
  if (!personId) return null;

  let cardEmail = order.sales_person?.email?.trim();
  let name = order.sales_person?.name?.trim() ?? "Handlowiec";

  if (!cardEmail || !order.sales_person?.name?.trim()) {
    const { data: sp } = await supabase
      .from("sales_people")
      .select("email, name")
      .eq("id", personId)
      .maybeSingle();
    cardEmail = cardEmail || sp?.email?.trim();
    if (sp?.name?.trim()) name = sp.name.trim();
  }

  const email = await resolveEmailForSalesPersonId(supabase, personId, cardEmail);
  if (!email) return null;
  return { personId, email, name };
}

/** E-mail handlowca po samym `sales_people.id` (np. odpowiedź na Tablicy). */
export async function resolveSalesPersonEmailById(
  supabase: SupabaseClient,
  salesPersonId: string | null | undefined
): Promise<ResolvedSalesPersonContact | null> {
  const personId = salesPersonId?.trim();
  if (!personId) return null;

  const { data: sp } = await supabase
    .from("sales_people")
    .select("id, email, name")
    .eq("id", personId)
    .maybeSingle();

  if (!sp?.id) return null;

  const email = await resolveEmailForSalesPersonId(supabase, personId, sp.email);
  if (!email) return null;

  return {
    personId: sp.id,
    email,
    name: sp.name?.trim() || "Handlowiec",
  };
}
