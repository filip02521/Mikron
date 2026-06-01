import { createClient } from "@supabase/supabase-js";
import fs from "fs";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing env");

  const supabase = createClient(url, key);
  const csvPath =
    process.argv[2] ||
    "/Users/Filip/Downloads/System Dostaw v.9 Synchronizacja DK z HI, Częściowa realizacja - DLA KOGOŚ (1).csv";
  const csv = fs.readFileSync(csvPath, "utf8");
  const lines = csv.trim().split("\n").slice(1);
  const ids = lines
    .map((l) => {
      const m = l.match(/([0-9a-f-]{36})\s*$/i);
      return m?.[1] ?? null;
    })
    .filter(Boolean) as string[];

  console.log("CSV rows:", lines.length, "IDs:", ids.length);

  const { data, error } = await supabase
    .from("individual_orders")
    .select(
      "id, status, request_kind, quantity, informacja_queue_via_daily_panel, sales_person_id"
    )
    .in("id", ids);
  if (error) throw error;

  const byStatus: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  for (const r of data ?? []) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    byKind[r.request_kind] = (byKind[r.request_kind] ?? 0) + 1;
  }
  console.log("In DB:", data?.length, "missing:", ids.length - (data?.length ?? 0));
  console.log("By status:", byStatus);
  console.log("By kind:", byKind);

  const rows = data ?? [];
  const inDelivery = rows.filter(
    (r) =>
      r.request_kind === "zamowienie" &&
      (r.status === "Zamowione" || r.status === "Czesciowo_zrealizowane")
  );
  const inInfoNowe = rows.filter(
    (r) => r.request_kind === "informacja" && r.status === "Nowe"
  );
  const inInfoZam = rows.filter(
    (r) => r.request_kind === "informacja" && r.status === "Zamowione"
  );
  const viaPanel = rows.filter((r) => r.informacja_queue_via_daily_panel);

  const inInfoQueue = rows.filter((r) => {
    if (r.request_kind !== "informacja" || r.status === "Zrealizowane") return false;
    if (r.status === "Zamowione" || r.status === "Czesciowo_zrealizowane") return true;
    return r.status === "Nowe" && !r.informacja_queue_via_daily_panel;
  });

  console.log("\nQueue visibility:");
  console.log("  delivery queue (zamowienie Zamowione):", inDelivery.length);
  console.log("  informacja warehouse queue:", inInfoQueue.length);
  console.log("  (was hidden informacja Zamowione only):", inInfoZam.length);
  console.log("  via_daily_panel flag:", viaPanel.length);

  if (inInfoZam.length) {
    console.log("\nSample hidden informacja Zamowione:");
    inInfoZam.slice(0, 5).forEach((r) => console.log(" ", r.id, r.quantity));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
