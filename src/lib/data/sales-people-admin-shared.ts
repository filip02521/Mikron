/** Status konta handlowca w UI — bezpieczne dla klienta (bez I/O Supabase). */

import { formatPlDate } from "@/lib/display-labels";

export type SalesPersonAdminRow = {
  id: string;
  name: string;
  email: string;
  groupId: string | null;
  groupName: string | null;
  orderCount: number;
  /** Aktywne ZK oczekujące na towar. */
  pendingZkCount: number;
  /** Aktywne ZK z przypomnieniem na dziś lub wcześniej. */
  followUpDueZkCount: number;
  /** Aktywne notatki z przypomnieniem na dziś lub wcześniej. */
  followUpDueNotesCount: number;
  linkedUserId: string | null;
  linkedUserEmail: string | null;
  /** Data utworzenia profilu / konta w systemie (profiles.created_at). */
  linkedUserCreatedAt: string | null;
  /** Ostatnie logowanie (Supabase Auth — tylko nowa sesja, nie każda akcja). */
  linkedUserLastSignInAt: string | null;
  /** Ostatnia znana aktywność: logowanie, tablica, prośby. */
  linkedUserLastActivityAt: string | null;
};

function formatAccountDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return formatPlDate(iso.slice(0, 10)) ?? null;
}

/** Krótka etykieta kolumny „Konto” na karcie handlowca w podglądzie zespołu. */
export function formatSalesPersonAccountStatus(
  row: Pick<
    SalesPersonAdminRow,
    "linkedUserEmail" | "linkedUserLastActivityAt" | "linkedUserLastSignInAt"
  >
): string {
  if (!row.linkedUserEmail) return "Brak konta";
  const activity = formatAccountDate(row.linkedUserLastActivityAt);
  if (activity) return `Aktyw. ${activity}`;
  if (row.linkedUserLastSignInAt) {
    return `Log. ${formatAccountDate(row.linkedUserLastSignInAt) ?? "—"}`;
  }
  return "Brak aktywności";
}

/** Podpowiedź po najechaniu na status konta w podglądzie zespołu. */
export function formatSalesPersonAccountStatusTitle(
  row: Pick<
    SalesPersonAdminRow,
    | "linkedUserEmail"
    | "linkedUserCreatedAt"
    | "linkedUserLastSignInAt"
    | "linkedUserLastActivityAt"
  >
): string | undefined {
  if (!row.linkedUserEmail) return "Brak powiązanego konta użytkownika";
  const created = formatAccountDate(row.linkedUserCreatedAt);
  const activity = formatAccountDate(row.linkedUserLastActivityAt);
  const signIn = formatAccountDate(row.linkedUserLastSignInAt);

  if (!activity && !signIn) {
    return created
      ? `Konto od ${created} — brak zarejestrowanej aktywności`
      : "Konto aktywne — brak zarejestrowanej aktywności";
  }

  const parts: string[] = [];
  if (created) parts.push(`Konto od ${created}`);
  if (activity) parts.push(`Ostatnia aktywność: ${activity}`);
  if (signIn && signIn !== activity) parts.push(`Ostatnie logowanie: ${signIn}`);
  return `${parts.join(". ")}.`;
}
