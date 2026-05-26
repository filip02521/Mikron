import type { SupabaseClient } from "@supabase/supabase-js";

const SKIP_ALIASES = new Set(["", "-", "—"]);

/** Skróty z arkusza → nazwa karty handlowca (jeśli inna). */
export const SALES_SHEET_ALIASES: Record<string, string> = {
  "KASIA J": "Kasia J.",
  "KASIA J.": "Kasia J.",
  "OLA G.": "Ola G.",
  "OLA G": "Ola G.",
  "OLA SZ.": "Ola Sz.",
  "OLA S.": "Ola S.",
  "OLA K.": "Ola K.",
  "KASIA K.": "Kasia K.",
  "K.J.": "Kasia J.",
  "NA STAN": "STAN",
  MADZIA: "Magda",
  "K.J": "Kasia J.",
  "K.J.": "Kasia J.",
  "OLA K": "Ola K.",
  "OLA SZ": "Ola Sz.",
  "OLA STU": "Ola Sz.",
  SZYMON: "Szymon R.",
  ALINA: "Ala",
  "KAMIL W": "Kamil",
};

export function normalizeSalesAlias(raw: string): string | null {
  const trimmed = raw.trim();
  if (SKIP_ALIASES.has(trimmed)) return null;
  if (/^\d+$/.test(trimmed)) return null;
  const upper = trimmed.toUpperCase();
  return SALES_SHEET_ALIASES[upper] ?? trimmed;
}

export function aliasToImportEmail(alias: string): string {
  const slug =
    alias
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 48) || "handlowiec";
  return `${slug}@import.historia.mikran`;
}

export async function ensureSalesPeopleFromAliases(
  supabase: SupabaseClient,
  aliases: Iterable<string>
): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  const { data: existing } = await supabase.from("sales_people").select("id, name, email");
  for (const p of existing ?? []) {
    byName.set(p.name.toUpperCase().trim(), p.id);
  }

  const pending = new Map<string, { name: string; email: string }>();
  const usedEmails = new Set((existing ?? []).map((p) => p.email.toLowerCase()));

  for (const raw of aliases) {
    const name = normalizeSalesAlias(raw);
    if (!name) continue;
    const key = name.toUpperCase().trim();
    if (byName.has(key) || pending.has(key)) continue;

    let email = aliasToImportEmail(name);
    let n = 2;
    while (usedEmails.has(email) || [...pending.values()].some((p) => p.email === email)) {
      email = aliasToImportEmail(`${name}.${n++}`);
    }
    usedEmails.add(email);
    pending.set(key, { name, email });
  }

  for (const { name, email } of pending.values()) {
    const { data, error } = await supabase
      .from("sales_people")
      .upsert({ name, email }, { onConflict: "email" })
      .select("id")
      .single();
    if (error) {
      console.warn("Handlowiec", name, error.message);
      continue;
    }
    if (data) byName.set(name.toUpperCase().trim(), data.id);
  }

  return byName;
}

export function resolveSalesPersonId(
  raw: string,
  byName: Map<string, string>
): string | null {
  const trimmed = raw.trim();
  if (!trimmed || SKIP_ALIASES.has(trimmed)) return null;

  const name = normalizeSalesAlias(trimmed);
  if (name) {
    const id = byName.get(name.toUpperCase().trim());
    if (id) return id;
  }

  if (trimmed.includes("/")) {
    for (const part of trimmed.split("/")) {
      const id = resolveSalesPersonId(part, byName);
      if (id) return id;
    }
  }

  return byName.get(trimmed.toUpperCase()) ?? null;
}
