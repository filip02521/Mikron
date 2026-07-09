import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isSalesManager } from "@/lib/auth-roles";
import {
  filterRowsByGroupScope,
  getManagedGroupIdsForUser,
} from "@/lib/data/sales-group-access";
import { fetchAllAuthUsersLastSignIn } from "@/lib/data/users";
import { formatPlDate } from "@/lib/display-labels";
import {
  isTeamSalesPerson,
} from "@/lib/sales/sales-person-catalog";
import {
  fetchLastActivityAtByProfileId,
  fetchLastActivityAtBySalesPersonId,
  maxIsoTimestamp,
} from "@/lib/data/sales-person-activity";
import { isFollowUpDue } from "@/lib/sales/notepad-follow-up";

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

export async function fetchSalesPeopleAdmin(): Promise<SalesPersonAdminRow[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();

  const [{ data: people, error: peopleError }, { data: profiles, error: profilesError }, { data: watchRows, error: watchesError }, { data: noteRows, error: notesError }] =
    await Promise.all([
      supabase.from("sales_people").select("id, name, email, group_id").order("name"),
      supabase
        .from("profiles")
        .select("id, email, sales_person_id, created_at")
        .not("sales_person_id", "is", null),
      supabase
        .from("sales_zk_watches")
        .select("sales_person_id, follow_up_at, closed_at, archived_at")
        .is("closed_at", null)
        .is("archived_at", null),
      supabase
        .from("sales_notes")
        .select("sales_person_id, follow_up_at, archived_at")
        .is("archived_at", null),
    ]);

  if (peopleError) throw new Error(peopleError.message);
  if (profilesError) throw new Error(profilesError.message);
  if (watchesError) throw new Error(watchesError.message);
  if (notesError) throw new Error(notesError.message);

  const lastSignInByUserId = await fetchAllAuthUsersLastSignIn(supabase);

  const { data: groups, error: groupsError } = await supabase
    .from("sales_groups")
    .select("id, name");
  if (groupsError) throw new Error(groupsError.message);
  const groupNameById = new Map((groups ?? []).map((g) => [g.id, g.name]));

  const linkedBySalesId = new Map(
    (profiles ?? []).map((p) => [
      p.sales_person_id as string,
      { id: p.id, email: p.email ?? "—", createdAt: (p.created_at as string | null) ?? null },
    ])
  );

  const profileIds = [...linkedBySalesId.values()].map((linked) => linked.id);
  const [activityByProfileId, activityBySalesPersonId] = await Promise.all([
    fetchLastActivityAtByProfileId(supabase, profileIds),
    fetchLastActivityAtBySalesPersonId(
      supabase,
      (people ?? []).map((person) => person.id as string)
    ),
  ]);

  const { data: orderRows, error: ordersError } = await supabase
    .from("individual_orders")
    .select("sales_person_id");
  if (ordersError) throw new Error(ordersError.message);

  const orderCountBySalesId = new Map<string, number>();
  for (const row of orderRows ?? []) {
    const id = row.sales_person_id;
    if (!id) continue;
    orderCountBySalesId.set(id, (orderCountBySalesId.get(id) ?? 0) + 1);
  }

  const pendingZkBySalesId = new Map<string, number>();
  const followUpDueZkBySalesId = new Map<string, number>();
  for (const row of watchRows ?? []) {
    const id = row.sales_person_id;
    if (!id) continue;
    pendingZkBySalesId.set(id, (pendingZkBySalesId.get(id) ?? 0) + 1);
    if (isFollowUpDue(row.follow_up_at)) {
      followUpDueZkBySalesId.set(id, (followUpDueZkBySalesId.get(id) ?? 0) + 1);
    }
  }

  const followUpDueNotesBySalesId = new Map<string, number>();
  for (const row of noteRows ?? []) {
    const id = row.sales_person_id;
    if (!id) continue;
    if (isFollowUpDue(row.follow_up_at)) {
      followUpDueNotesBySalesId.set(id, (followUpDueNotesBySalesId.get(id) ?? 0) + 1);
    }
  }

  return (people ?? []).map((p) => {
    const linked = linkedBySalesId.get(p.id);
    const groupId = (p.group_id as string | null) ?? null;
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      groupId,
      groupName: groupId ? (groupNameById.get(groupId) ?? null) : null,
      orderCount: orderCountBySalesId.get(p.id) ?? 0,
      pendingZkCount: pendingZkBySalesId.get(p.id) ?? 0,
      followUpDueZkCount: followUpDueZkBySalesId.get(p.id) ?? 0,
      followUpDueNotesCount: followUpDueNotesBySalesId.get(p.id) ?? 0,
      linkedUserId: linked?.id ?? null,
      linkedUserEmail: linked?.email ?? null,
      linkedUserCreatedAt: linked?.createdAt ?? null,
      linkedUserLastSignInAt: linked?.id
        ? (lastSignInByUserId.get(linked.id) ?? null)
        : null,
      linkedUserLastActivityAt: linked?.id
        ? maxIsoTimestamp(
            lastSignInByUserId.get(linked.id) ?? null,
            activityByProfileId.get(linked.id) ?? null,
            activityBySalesPersonId.get(p.id) ?? null
          )
        : null,
    };
  });
}

export async function fetchSalesPeopleAdminForUser(
  user: Pick<SessionUser, "id" | "role" | "email" | "salesPersonId">
): Promise<SalesPersonAdminRow[]> {
  const rows = await fetchSalesPeopleAdmin();
  const scope = await getManagedGroupIdsForUser(user);
  const scoped = filterRowsByGroupScope(rows, scope).filter(isTeamSalesPerson);

  if (isSalesManager(user.role)) {
    const own = await resolveSalesPersonForUser(user);
    if (own) {
      const ownRow = rows.find((row) => row.id === own.id);
      if (ownRow && !scoped.some((row) => row.id === own.id)) {
        scoped.push(ownRow);
      }
    }
  }

  return scoped.sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

/**
 * Handlowcy z Admin → Handlowcy — bez wpisów z importu historii
 * (np. „Kamil / Nazwa kliniki”, e-mail @import.historia.mikran).
 */
export async function fetchSalesPeopleForPicker(): Promise<
  Array<{ id: string; name: string; email: string }>
> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_people")
    .select("id, name, email, group_id")
    .order("name");

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) =>
      isTeamSalesPerson({
        groupId: (row.group_id as string | null) ?? null,
        email: (row.email as string | null) ?? "",
        name: (row.name as string | null) ?? "",
      })
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
    }));
}

/** Wszyscy handlowcy z tej samej grupy co dany handlowiec (włącznie z nim). */
export async function fetchSalesPeopleInSameGroup(
  salesPersonId: string
): Promise<Array<{ id: string; name: string; linkedUserId: string | null }>> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();

  const { data: own, error: ownError } = await supabase
    .from("sales_people")
    .select("group_id")
    .eq("id", salesPersonId)
    .maybeSingle();
  if (ownError || !own?.group_id) return [];

  const groupId = own.group_id as string;

  const { data: people, error: peopleError } = await supabase
    .from("sales_people")
    .select("id, name, email")
    .eq("group_id", groupId)
    .order("name");
  if (peopleError) throw new Error(peopleError.message);

  const ids = (people ?? []).map((p) => p.id as string);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, sales_person_id")
    .in("sales_person_id", ids);
  const linkedBySalesId = new Map(
    (profiles ?? []).map((p) => [p.sales_person_id as string, p.id as string])
  );

  return (people ?? [])
    .filter((p) =>
      isTeamSalesPerson({
        name: p.name,
        email: p.email,
        groupId,
      })
    )
    .map((p) => ({
      id: p.id as string,
      name: p.name,
      linkedUserId: linkedBySalesId.get(p.id) ?? null,
    }));
}
