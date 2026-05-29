import { unstable_cache } from "next/cache";
import { hasSupabaseConfig } from "@/lib/supabase/admin";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";
import { loadAppSupplierRefsWithAliases } from "@/lib/data/supplier-subiekt-kh";

async function loadAppSupplierRefs(): Promise<AppSupplierRef[]> {
  if (!hasSupabaseConfig()) return [];
  return loadAppSupplierRefsWithAliases();
}

/** Lekka lista dostawców do dopasowań Subiekt — cache 5 min w procesie Next. */
export const getAppSupplierRefsCached = unstable_cache(
  loadAppSupplierRefs,
  ["app-supplier-refs"],
  { revalidate: 300, tags: ["app-supplier-refs"] }
);
