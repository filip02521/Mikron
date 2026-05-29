import { createAdminClient } from "@/lib/supabase/admin";
import type { SalesNote, SalesPaymentWatch } from "@/types/database";

export type SalesNotepadData = {
  paymentWatches: SalesPaymentWatch[];
  archivedPaymentWatches: SalesPaymentWatch[];
  notes: SalesNote[];
  archivedNotes: SalesNote[];
};

export async function fetchSalesNotepad(
  salesPersonId: string
): Promise<SalesNotepadData> {
  const supabase = createAdminClient();

  const [watchesRes, notesRes] = await Promise.all([
    supabase
      .from("sales_payment_watches")
      .select("*")
      .eq("sales_person_id", salesPersonId)
      .order("created_at", { ascending: true }),
    supabase
      .from("sales_notes")
      .select("*")
      .eq("sales_person_id", salesPersonId)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false }),
  ]);

  if (watchesRes.error) throw new Error(watchesRes.error.message);
  if (notesRes.error) throw new Error(notesRes.error.message);

  const watches = (watchesRes.data ?? []) as SalesPaymentWatch[];
  const notes = (notesRes.data ?? []) as SalesNote[];

  return {
    paymentWatches: watches.filter((w) => !w.settled_at && !w.archived_at),
    archivedPaymentWatches: watches.filter((w) => w.settled_at || w.archived_at),
    notes: notes.filter((n) => !n.archived_at),
    archivedNotes: notes.filter((n) => n.archived_at),
  };
}

export async function countActivePaymentWatches(
  salesPersonId: string
): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("sales_payment_watches")
    .select("id", { count: "exact", head: true })
    .eq("sales_person_id", salesPersonId)
    .is("settled_at", null)
    .is("archived_at", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Badge notatnika: aktywne ZK + notatki z follow-up na dziś/wcześniej. */
export async function countNotepadNavBadge(salesPersonId: string): Promise<number> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [activeZk, notesDueRes] = await Promise.all([
    countActivePaymentWatches(salesPersonId),
    supabase
      .from("sales_notes")
      .select("id", { count: "exact", head: true })
      .eq("sales_person_id", salesPersonId)
      .is("archived_at", null)
      .not("follow_up_at", "is", null)
      .lte("follow_up_at", today),
  ]);

  if (notesDueRes.error) throw new Error(notesDueRes.error.message);
  return activeZk + (notesDueRes.count ?? 0);
}
