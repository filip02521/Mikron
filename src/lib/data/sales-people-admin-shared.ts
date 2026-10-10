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
  /** Prośby w toku, towar na regale do odbioru, termin ZD minął — widok kierownika. */
  openOrderCount: number;
  shelfWaitingCount: number;
  overdueZdCount: number;
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
    return `Log. ${formatAccountDate(row.linkedUserLastSignInAt) ?? "-"}`;
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
      ? `Konto od ${created} - brak zarejestrowanej aktywności`
      : "Konto aktywne - brak zarejestrowanej aktywności";
  }

  const parts: string[] = [];
  if (created) parts.push(`Konto od ${created}`);
  if (activity) parts.push(`Ostatnia aktywność: ${activity}`);
  if (signIn && signIn !== activity) parts.push(`Ostatnie logowanie: ${signIn}`);
  return `${parts.join(". ")}.`;
}

export type SalesPersonOrderAttentionRow = {
  sales_person_id: string | null;
  status: string;
  request_kind: string | null;
  is_teeth: boolean | null;
  warehouse_cleared_at: string | null;
  zd_fulfillment_deadline: string | null;
};

export type SalesPersonOrderAttention = {
  /** Prośby w toku (bez zakończonych i anulowanych). */
  openCount: number;
  /** Towar na regale czeka na odbiór handlowca. */
  shelfWaitingCount: number;
  /** Termin z ZD minął, a towar nie dotarł w całości. */
  overdueZdCount: number;
};

/**
 * Stany próśb dla widoku kierownika — wejście: niepotwierdzone i niewycofane prośby.
 * `todayKey` = YYYY-MM-DD (Warszawa); termin ZD „dziś” jeszcze nie jest po terminie.
 */
export function summarizeSalesPersonOrderAttention(
  rows: SalesPersonOrderAttentionRow[],
  todayKey: string
): Map<string, SalesPersonOrderAttention> {
  const out = new Map<string, SalesPersonOrderAttention>();
  for (const row of rows) {
    if (!row.sales_person_id || row.status === "Anulowane") continue;
    const acc = out.get(row.sales_person_id) ?? { openCount: 0, shelfWaitingCount: 0, overdueZdCount: 0 };
    const delivered = row.status === "Zrealizowane" || row.status === "Czesciowo_zrealizowane";
    if (
      delivered &&
      row.request_kind === "zamowienie" &&
      !row.is_teeth &&
      !row.warehouse_cleared_at
    ) {
      acc.shelfWaitingCount++;
    }
    if (row.status !== "Zrealizowane") {
      acc.openCount++;
      const deadline = row.zd_fulfillment_deadline?.slice(0, 10);
      if (deadline && deadline < todayKey) acc.overdueZdCount++;
    }
    out.set(row.sales_person_id, acc);
  }
  return out;
}
