import { unstable_cache } from "next/cache";
import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";

async function loadAppSupplierRefs(): Promise<AppSupplierRef[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, subiekt_kh_id")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    subiektKhId: s.subiekt_kh_id ?? null,
  }));
}

/** Lekka lista dostawców do dopasowań Subiekt — cache 5 min w procesie Next. */
export const getAppSupplierRefsCached = unstable_cache(
  loadAppSupplierRefs,
  ["app-supplier-refs"],
  { revalidate: 300 }
);
