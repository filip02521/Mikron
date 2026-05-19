/**
 * Migracja danych z eksportów CSV Google Sheets.
 *
 * Użycie:
 *   export $(cat .env.local | xargs)
 *   npx tsx scripts/migrate-from-csv.ts ./data
 *
 * Oczekiwane pliki w katalogu data/:
 *   ustawienia.csv, urlopey.csv, sprzedaz.csv,
 *   historia_indywidualne.csv, historia.csv (opcjonalnie)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  intervalWeeksForStorage,
  parseInterval,
} from "../src/lib/orders/dates";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) {
  console.error("Ustaw NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

function parseCsv(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    const result: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQ = !inQ;
        continue;
      }
      if (c === "," && !inQ) {
        result.push(cur.trim());
        cur = "";
      } else cur += c;
    }
    result.push(cur.trim());
    return result;
  });
}

function loadCsv(dir: string, name: string): string[][] | null {
  const p = join(dir, name);
  if (!existsSync(p)) return null;
  return parseCsv(readFileSync(p, "utf-8"));
}

function headerIndex(headers: string[], ...names: string[]): number {
  const upper = headers.map((h) => h.toUpperCase().trim());
  for (const n of names) {
    const i = upper.indexOf(n.toUpperCase());
    if (i >= 0) return i;
  }
  return -1;
}

async function main() {
  const dir = process.argv[2] || "./data";
  console.log("Migracja z:", dir);

  const settings = loadCsv(dir, "ustawienia.csv");
  if (!settings || settings.length < 2) {
    console.error("Brak ustawienia.csv");
    process.exit(1);
  }

  const headers = settings[0];
  const col = {
    supplier: headerIndex(headers, "DOSTAWCY", "DOSTAWCA"),
    location: headerIndex(headers, "LOKALIZACJA"),
    pickup: headerIndex(headers, "ODBIÓR", "ODBIOR"),
    notes: headerIndex(headers, "SPOSÓB"),
    mails: headerIndex(headers, "MAILE / STRONY", "MAILE"),
    extra: headerIndex(headers, "DODATKOWE"),
    interval: headerIndex(headers, "INTERWAL"),
    stock: headerIndex(headers, "ZAPAS"),
    stats: headerIndex(headers, "STATYSTYKI"),
  };

  const supplierIdByName = new Map<string, string>();
  let supplierCount = 0;

  for (let i = 1; i < settings.length; i++) {
    const row = settings[i];
    const name = row[col.supplier]?.trim();
    const location = (row[col.location]?.trim() || "POLSKA").toUpperCase();
    if (!name) continue;
    if (!["POLSKA", "ZAGRANICA", "IMPORT"].includes(location)) continue;

    const pickup = (row[col.pickup] || "").toUpperCase();
    const statsRaw = (row[col.stats] || "ŁĄCZNIE").toUpperCase();
    const { data, error } = await supabase
      .from("suppliers")
      .upsert(
        {
          name,
          location,
          pickup_mikran: pickup.includes("KIEROWCA MIKRAN"),
          pickup_pallet: pickup.includes("ZLECAMY ODBIÓR") || pickup.includes("ZLECAMY ODBIOR"),
          notes: row[col.notes] || "",
          mails: row[col.mails] || "",
          extra_info: row[col.extra] || "",
          interval_raw: (row[col.interval] || "").trim(),
          interval_weeks: intervalWeeksForStorage(
            row[col.interval] || "",
            parseInterval(row[col.interval] || "")
          ),
          stock_raw: (row[col.stock] || "").trim(),
          stock: intervalWeeksForStorage(
            row[col.stock] || "",
            parseInterval(row[col.stock] || "")
          ),
          stats_mode: statsRaw === "OSOBNO" ? "OSOBNO" : "LACZNIE",
        },
        { onConflict: "name" }
      )
      .select("id")
      .single();

    if (error) {
      console.warn("Supplier", name, error.message);
      continue;
    }
    supplierIdByName.set(name.toUpperCase(), data.id);
    await supabase
      .from("supplier_schedules")
      .upsert({ supplier_id: data.id }, { onConflict: "supplier_id" });
    supplierCount++;
  }
  console.log("Dostawcy:", supplierCount);

  const sales = loadCsv(dir, "sprzedaz.csv");
  const salesIdByName = new Map<string, string>();
  if (sales && sales.length > 1) {
    const h = sales[0];
    const nameI = headerIndex(h, "IMIĘ", "IMIE", "NAZWA", "NAME");
    const emailI = headerIndex(h, "EMAIL", "E-MAIL", "MAIL");
    for (let i = 1; i < sales.length; i++) {
      const name = sales[i][nameI >= 0 ? nameI : 0]?.trim();
      const email = sales[i][emailI >= 0 ? emailI : 1]?.trim();
      if (!name || !email) continue;
      const { data } = await supabase
        .from("sales_people")
        .upsert({ name, email }, { onConflict: "email" })
        .select("id")
        .single();
      if (data) salesIdByName.set(name.toUpperCase(), data.id);
    }
    console.log("Handlowcy:", salesIdByName.size);
  }

  const vacations = loadCsv(dir, "urlopey.csv");
  if (vacations && vacations.length > 1) {
    const h = vacations[0];
    const sI = headerIndex(h, "DOSTAWCA", "DOSTAWCY");
    const startI = headerIndex(h, "OD", "START", "DATA OD");
    const endI = headerIndex(h, "DO", "END", "DATA DO");
    const lastI = headerIndex(h, "ZAMÓWIENIE", "OSTATNIE", "LAST");
    const statusI = headerIndex(h, "STATUS");
    let vCount = 0;
    for (let i = 1; i < vacations.length; i++) {
      const supplierName = vacations[i][sI]?.trim().toUpperCase();
      const sid = supplierName ? supplierIdByName.get(supplierName) : undefined;
      if (!sid) continue;
      const active = !statusI || vacations[i][statusI]?.toLowerCase().includes("aktyw");
      await supabase.from("vacations").insert({
        supplier_id: sid,
        start_date: vacations[i][startI],
        end_date: vacations[i][endI],
        last_order_date: vacations[i][lastI],
        active,
      });
      vCount++;
    }
    console.log("Urlopy:", vCount);
  }

  const hist = loadCsv(dir, "historia_indywidualne.csv");
  if (hist && hist.length > 1) {
    const h = hist[0];
    const statusMap: Record<string, string> = {
      Nowe: "Nowe",
      Zamówione: "Zamowione",
      Zrealizowane: "Zrealizowane",
      "Częściowo zrealizowane": "Czesciowo_zrealizowane",
      Anulowane: "Anulowane",
    };
    let oCount = 0;
    for (let i = 1; i < hist.length; i++) {
      const row = hist[i];
      const supplier = row[headerIndex(h, "DOSTAWCA")]?.trim();
      const person = row[headerIndex(h, "DLA KOGO", "OSOBA", "FOR_WHOM")]?.trim();
      const sid = supplier ? supplierIdByName.get(supplier.toUpperCase()) : undefined;
      const pid = person ? salesIdByName.get(person.toUpperCase()) : undefined;
      if (!sid || !pid) continue;
      const statusRaw = row[headerIndex(h, "STATUS")] || "Nowe";
      const status = statusMap[statusRaw] || "Nowe";
      await supabase.from("individual_orders").insert({
        id: row[headerIndex(h, "ID")] || undefined,
        supplier_id: sid,
        sales_person_id: pid,
        symbol: row[headerIndex(h, "SYMBOL")] || "-",
        products: row[headerIndex(h, "PRODUKT", "PRODUKTY")] || "-",
        quantity: row[headerIndex(h, "ILOŚĆ", "ILOSC")] || "-",
        delivered_quantity: row[headerIndex(h, "DOSTARCZONO")] || "-",
        status,
        order_type: "None",
      });
      oCount++;
    }
    console.log("Historia indywidualna:", oCount);
  }

  console.log("\nWalidacja:");
  const { count: sc } = await supabase
    .from("suppliers")
    .select("*", { count: "exact", head: true });
  const { count: oc } = await supabase
    .from("individual_orders")
    .select("*", { count: "exact", head: true });
  console.log("  suppliers:", sc);
  console.log("  individual_orders:", oc);
  console.log("Migracja zakończona.");
}

main().catch(console.error);
