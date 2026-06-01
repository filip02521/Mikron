import { createAdminClient } from "@/lib/supabase/admin";
import type { SalesNote, SalesZkWatch } from "@/types/database";

export type SalesNotepadData = {
  zkWatches: SalesZkWatch[];
  archivedZkWatches: SalesZkWatch[];
  notes: SalesNote[];
  archivedNotes: SalesNote[];
};

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

export async function fetchSalesNotepad(
  salesPersonId: string
): Promise<SalesNotepadData> {
  const supabase = createAdminClient();

  const [watchesRes, notesRes] = await Promise.all([
    supabase
      .from("sales_zk_watches")
      .select("*")
      .eq("sales_person_id", salesPersonId)
      .order("created_at", { ascending: true }),
    supabase
      .from("sales_notes")
      .select("*")
      .eq("sales_person_id", salesPersonId)
      .order("pinned", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false }),
  ]);

  if (watchesRes.error) throw new Error(watchesRes.error.message);
  if (notesRes.error) throw new Error(notesRes.error.message);

  const watches = (watchesRes.data ?? []) as SalesZkWatch[];
  const notes = (notesRes.data ?? []) as SalesNote[];
  const { zkWatches, archivedZkWatches } = partitionSalesZkWatches(watches);

  return {
    zkWatches,
    archivedZkWatches,
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

/** Badge notatnika: ZK i notatki z przypomnieniem na dziś/wcześniej. */
export async function countNotepadNavBadge(salesPersonId: string): Promise<number> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [watchesDueRes, notesDueRes] = await Promise.all([
    supabase
      .from("sales_zk_watches")
      .select("id", { count: "exact", head: true })
      .eq("sales_person_id", salesPersonId)
      .is("closed_at", null)
      .is("archived_at", null)
      .not("follow_up_at", "is", null)
      .lte("follow_up_at", today),
    supabase
      .from("sales_notes")
      .select("id", { count: "exact", head: true })
      .eq("sales_person_id", salesPersonId)
      .is("archived_at", null)
      .not("follow_up_at", "is", null)
      .lte("follow_up_at", today),
  ]);

  if (watchesDueRes.error) throw new Error(watchesDueRes.error.message);
  if (notesDueRes.error) throw new Error(notesDueRes.error.message);
  return (watchesDueRes.count ?? 0) + (notesDueRes.count ?? 0);
}
