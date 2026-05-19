import { createClient } from "@supabase/supabase-js";

/** Szybkie sprawdzenie w middleware (Edge) — czy jest już admin w bazie */
export async function middlewareNeedsBootstrap(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if (error) {
    console.error("middlewareNeedsBootstrap:", error.message);
    return false;
  }
  return (count ?? 0) === 0;
}
