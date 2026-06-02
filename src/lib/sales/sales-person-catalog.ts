/** E-mail sztucznych kart z importu historii (handlowiec / klient w jednym polu). */
export const SALES_PERSON_IMPORT_EMAIL_DOMAIN = "@import.historia.mikran";

/** Handlowiec dodany w Admin → Handlowcy (prawdziwy e-mail), nie wpis z importu CSV. */
export function isManagedSalesPersonEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e.includes("@")) return false;
  return !e.endsWith(SALES_PERSON_IMPORT_EMAIL_DOMAIN);
}

export function hasSalesTeamGroup(groupId: string | null | undefined): boolean {
  return Boolean(groupId?.trim());
}

/** Widoczny w zespole, pickerach i listach — przypisana grupa + firmowy e-mail. */
export function isTeamSalesPerson(row: {
  name: string;
  email: string;
  groupId?: string | null;
}): boolean {
  return hasSalesTeamGroup(row.groupId) && isManagedSalesPersonEmail(row.email);
}

/** Karta bez grupy (zwykle import lub „Jan / Klinika”). */
export function isUngroupedSalesPerson(row: { groupId?: string | null }): boolean {
  return !hasSalesTeamGroup(row.groupId);
}
