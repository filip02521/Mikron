import { findZkWatchByNumber } from "@/lib/sales/find-zk-watch-by-number";
import type { SalesZkWatch } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Jedna karta ZK do prefillu prośby — bez ładowania wszystkich snapshotów handlowca. */
export async function fetchZkWatchForProsbaPrefill(
  supabase: SupabaseClient,
  salesPersonId: string,
  zkNumber: string
): Promise<SalesZkWatch | null> {
  const trimmed = zkNumber.trim();
  if (!trimmed) return null;

  const { data: exact, error: exactError } = await supabase
    .from("sales_zk_watches")
    .select("*")
    .eq("sales_person_id", salesPersonId)
    .eq("zk_number", trimmed)
    .maybeSingle();

  if (exactError) throw new Error(exactError.message);
  if (exact) return exact as SalesZkWatch;

  const { data: list, error: listError } = await supabase
    .from("sales_zk_watches")
    .select("id, zk_number")
    .eq("sales_person_id", salesPersonId);

  if (listError) throw new Error(listError.message);

  const hit = findZkWatchByNumber(
    (list ?? []) as Array<{ id: string; zk_number: string }>,
    trimmed
  );
  if (!hit?.id) return null;

  const watchId = String(hit.id);

  const { data: full, error: fullError } = await supabase
    .from("sales_zk_watches")
    .select("*")
    .eq("id", watchId)
    .eq("sales_person_id", salesPersonId)
    .maybeSingle();

  if (fullError) throw new Error(fullError.message);
  return full ? (full as SalesZkWatch) : null;
}
