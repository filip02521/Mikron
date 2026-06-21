import { formatDateString } from "@/lib/orders/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayInWarsaw } from "@/lib/time/warsaw";
import type { ZkLinkableOrder } from "@/lib/sales/zk-watch-order-link";
import type { SalesNote, SalesZkWatch } from "@/types/database";

export type SalesNotepadData = {
  zkWatches: SalesZkWatch[];
  archivedZkWatches: SalesZkWatch[];
  notes: SalesNote[];
  archivedNotes: SalesNote[];
  /** Otwarte prośby handlowca — powiązanie z ZK (dostawa / podpowiedzi). */
  zkLinkableOrders: ZkLinkableOrder[];
  /** Brak kolumny sales_client_kh_id — uruchom migrację 052. */
  zkOrdersMigrationMissing?: boolean;
};

const ZK_LINK_ORDER_SELECT =
  "id, sales_person_id, sales_client_name, sales_client_kh_id, source_zk_watch_id, source_zk_number, subiekt_tw_id, symbol, products, mikran_code, quantity, delivered_quantity, status, request_kind, ordered_at, action_at, delivery_at, zd_fulfillment_deadline, zd_fulfillment_deadline_changed_at, sales_acknowledged_at, sales_cancelled_at";

export async function fetchZkLinkableOrdersForSalesPerson(
  salesPersonId: string
): Promise<{ orders: ZkLinkableOrder[]; migrationMissing: boolean }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select(ZK_LINK_ORDER_SELECT)
    .eq("sales_person_id", salesPersonId)
    .is("sales_cancelled_at", null)
    .order("action_at", { ascending: false })
    .limit(400);

  if (error) {
    if (
      error.message.includes("sales_client_kh_id") ||
      error.message.includes("source_zk")
    ) {
      return { orders: [], migrationMissing: true };
    }
    throw new Error(error.message);
  }

  return { orders: (data ?? []) as ZkLinkableOrder[], migrationMissing: false };
}

export function isZkWatchArchived(
  watch: Pick<SalesZkWatch, "closed_at" | "archived_at">
): boolean {
  return Boolean(watch.closed_at || watch.archived_at);
}

export function partitionSalesZkWatches(watches: SalesZkWatch[]): Pick<
  SalesNotepadData,
  "zkWatches" | "archivedZkWatches"
> {
  return {
    zkWatches: watches.filter((w) => !isZkWatchArchived(w)),
    archivedZkWatches: watches.filter((w) => isZkWatchArchived(w)),
  };
}

/** Lekkie pobranie pod panel Start dnia — bez powiązań ZK z zamówieniami. */
export async function fetchSalesDayStartNotepadSlice(
  salesPersonId: string
): Promise<{ zkWatches: SalesZkWatch[]; notes: SalesNote[] }> {
  const supabase = createAdminClient();

  const [watchesRes, notesRes] = await Promise.all([
    supabase
      .from("sales_zk_watches")
      .select("*")
      .eq("sales_person_id", salesPersonId)
      .is("closed_at", null)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("sales_notes")
      .select("*")
      .eq("sales_person_id", salesPersonId)
      .is("archived_at", null)
      .order("pinned", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false }),
  ]);

  if (watchesRes.error) throw new Error(watchesRes.error.message);
  if (notesRes.error) throw new Error(notesRes.error.message);

  return {
    zkWatches: (watchesRes.data ?? []) as SalesZkWatch[],
    notes: (notesRes.data ?? []) as SalesNote[],
  };
}

/** Dane strony /zk — aktywne ZK, archiwum ZK (undo/focus) i powiązania z prośbami. */
export async function fetchSalesZkPageData(
  salesPersonId: string
): Promise<
  Pick<
    SalesNotepadData,
    "zkWatches" | "archivedZkWatches" | "zkLinkableOrders" | "zkOrdersMigrationMissing"
  >
> {
  const supabase = createAdminClient();

  const [watchesRes, linkResult] = await Promise.all([
    supabase
      .from("sales_zk_watches")
      .select("*")
      .eq("sales_person_id", salesPersonId)
      .order("created_at", { ascending: true }),
    fetchZkLinkableOrdersForSalesPerson(salesPersonId),
  ]);

  if (watchesRes.error) throw new Error(watchesRes.error.message);

  const watches = (watchesRes.data ?? []) as SalesZkWatch[];
  const { zkWatches, archivedZkWatches } = partitionSalesZkWatches(watches);

  return {
    zkWatches,
    archivedZkWatches,
    zkLinkableOrders: linkResult.orders,
    zkOrdersMigrationMissing: linkResult.migrationMissing,
  };
}

/** Dane strony /notatnik — notatki i archiwum notatek. */
export async function fetchSalesNotesPageData(
  salesPersonId: string
): Promise<Pick<SalesNotepadData, "notes" | "archivedNotes">> {
  const supabase = createAdminClient();

  const notesRes = await supabase
    .from("sales_notes")
    .select("*")
    .eq("sales_person_id", salesPersonId)
    .order("pinned", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (notesRes.error) throw new Error(notesRes.error.message);

  const notes = (notesRes.data ?? []) as SalesNote[];

  return {
    notes: notes.filter((n) => !n.archived_at),
    archivedNotes: notes.filter((n) => n.archived_at),
  };
}

export async function countActiveZkWatches(salesPersonId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("sales_zk_watches")
    .select("id", { count: "exact", head: true })
    .eq("sales_person_id", salesPersonId)
    .is("closed_at", null)
    .is("archived_at", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Badge ZK: follow-up na dziś/wcześniej (tylko aktywne ZK). */
export async function countZkDueNavBadge(salesPersonId: string): Promise<number> {
  const supabase = createAdminClient();
  const today = formatDateString(todayInWarsaw());

  const { count, error } = await supabase
    .from("sales_zk_watches")
    .select("id", { count: "exact", head: true })
    .eq("sales_person_id", salesPersonId)
    .is("closed_at", null)
    .is("archived_at", null)
    .not("follow_up_at", "is", null)
    .lte("follow_up_at", today);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Badge notatek: follow-up na dziś/wcześniej (tylko aktywne notatki). */
export async function countNotesDueNavBadge(salesPersonId: string): Promise<number> {
  const supabase = createAdminClient();
  const today = formatDateString(todayInWarsaw());

  const { count, error } = await supabase
    .from("sales_notes")
    .select("id", { count: "exact", head: true })
    .eq("sales_person_id", salesPersonId)
    .is("archived_at", null)
    .not("follow_up_at", "is", null)
    .lte("follow_up_at", today);

  if (error) throw new Error(error.message);
  return count ?? 0;
}
