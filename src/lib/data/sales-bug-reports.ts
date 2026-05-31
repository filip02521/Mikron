import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { SalesBugReport, SalesBugReportStatus } from "@/types/database";

export async function countOpenSalesBugReports(): Promise<number> {
  if (!hasSupabaseConfig()) return 0;
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("sales_bug_reports")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");
  if (error) return 0;
  return count ?? 0;
}

export async function fetchSalesBugReports(
  status?: SalesBugReportStatus | "all"
): Promise<SalesBugReport[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  let query = supabase
    .from("sales_bug_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SalesBugReport[];
}
