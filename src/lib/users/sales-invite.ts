import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppUrl } from "@/lib/env/app-config";
import { assertUniqueSalesPersonLink } from "@/lib/users/sales-person-link";

export function appBaseUrl(): string {
  return getAppUrl();
}

export async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ id: string; email: string } | null> {
  const normalized = email.trim().toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);

    const hit = data.users.find((u) => u.email?.trim().toLowerCase() === normalized);
    if (hit?.email) return { id: hit.id, email: hit.email };

    if (data.users.length < 1000) break;
    page += 1;
  }

  return null;
}

export type SalesInviteLinkResult = {
  link: string;
  email: string;
  salesPersonName: string;
  /** Nowe konto przez zaproszenie vs. istniejące — tylko reset hasła */
  mode: "invite" | "recovery";
};

/** Link do /ustaw-haslo — handlowiec ustawia hasło i jest powiązany z kartą. */
export async function generateSalesPersonInviteLink(
  supabase: SupabaseClient,
  salesPersonId: string
): Promise<SalesInviteLinkResult | { error: string }> {
  const { data: person, error: personError } = await supabase
    .from("sales_people")
    .select("id, name, email")
    .eq("id", salesPersonId)
    .maybeSingle();

  if (personError) return { error: personError.message };
  if (!person) return { error: "Nie znaleziono handlowca." };

  const email = person.email?.trim().toLowerCase();
  if (!email) {
    return { error: "Uzupełnij e-mail handlowca — link wysyłasz na ten adres." };
  }

  const linkError = await assertUniqueSalesPersonLink(supabase, salesPersonId);
  if (linkError) return { error: linkError };

  const redirectTo = `${appBaseUrl()}/ustaw-haslo`;
  const existing = await findAuthUserByEmail(supabase, email);

  if (existing) {
    const { error: metaError } = await supabase.auth.admin.updateUserById(existing.id, {
      user_metadata: { sales_person_id: salesPersonId },
    });
    if (metaError) return { error: metaError.message };

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        role: "sales",
        sales_person_id: salesPersonId,
        email,
      })
      .eq("id", existing.id);

    if (profileError) return { error: profileError.message };

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (error || !data.properties?.action_link) {
      return { error: error?.message ?? "Nie udało się wygenerować linku." };
    }

    return {
      link: data.properties.action_link,
      email,
      salesPersonName: person.name,
      mode: "recovery",
    };
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo,
      data: { sales_person_id: salesPersonId },
    },
  });

  if (error || !data.properties?.action_link) {
    return { error: error?.message ?? "Nie udało się wygenerować linku zaproszenia." };
  }

  return {
    link: data.properties.action_link,
    email,
    salesPersonName: person.name,
    mode: "invite",
  };
}
