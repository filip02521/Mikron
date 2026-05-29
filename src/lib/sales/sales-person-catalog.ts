/** E-mail sztucznych kart z importu historii (handlowiec / klient w jednym polu). */
export const SALES_PERSON_IMPORT_EMAIL_DOMAIN = "@import.historia.mikran";

/** Handlowiec dodany w Admin → Handlowcy (prawdziwy e-mail), nie wpis z importu CSV. */
export function isManagedSalesPersonEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e.includes("@")) return false;
  return !e.endsWith(SALES_PERSON_IMPORT_EMAIL_DOMAIN);
}
