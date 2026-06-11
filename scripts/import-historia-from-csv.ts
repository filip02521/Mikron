/**
 * Import historii z CSV (eksport Google Sheets).
 *
 * Pliki w katalogu (opcjonalnie każdy z osobna):
 *   historia.csv              — zamówienia standardowe → normal_order_history
 *   historia_indywidualne.csv — prośby handlowców → individual_orders
 *
 *   npx tsx scripts/import-historia-from-csv.ts ./data
 *   npx tsx scripts/import-historia-from-csv.ts "/Users/.../Downloads" --fresh
 *   npx tsx scripts/import-historia-from-csv.ts ./data --rebuild-schedules
 *
 * Po imporcie HISTORIA (--fresh lub --rebuild-schedules) przelicza supplier_schedules:
 * Zamówione / Zamówienie Główne → data zamówienia; Przesunięte o N tyg. → shift_date z DATA NAST. ZAM.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { parseCsv, headerIndex } from "./lib/parse-csv";
import { parseDateOnly } from "../src/lib/orders/dates";
import { INFORMACJA_NO_QUANTITY } from "../src/lib/orders/individual";
import {
  shouldTreatAsInformacjaOnly,
} from "../src/lib/orders/informacja-import-rules";
import { matchSupplierId } from "../src/lib/orders/delivery-stats-import";
import {
  ensureSalesPeopleFromAliases,
  resolveSalesPersonId,
} from "./lib/sales-person-import";
import { rebuildAllSupplierSchedulesFromHistoria } from "../src/lib/services/rebuild-schedules-from-historia";
import { syncLocationSchedulesFromDir } from "./lib/sync-location-schedules-from-dir";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function loadCsv(dir: string, name: string): string[][] | null {
  const p = join(dir, name);
  if (!existsSync(p)) return null;
  return parseCsv(readFileSync(p, "utf-8"));
}

function isIndividualHistoriaFile(path: string): boolean {
  return /indywidual/i.test(path);
}

function findHistoriaCsv(dir: string, kind: "standard" | "individual"): string | null {
  const names = readdirSync(dir).filter((n) => n.toLowerCase().endsWith(".csv"));
  if (kind === "standard") {
    const exact = names.find((n) => /^historia\.csv$/i.test(n));
    if (exact) return join(dir, exact);
    const loose = names.find((n) => /historia/i.test(n) && !/indywidual/i.test(n));
    return loose ? join(dir, loose) : null;
  }
  const exact = names.find((n) => /^historia_indywidualne\.csv$/i.test(n));
  if (exact) return join(dir, exact);
  const loose = names.find((n) => /indywidual/i.test(n) && /historia/i.test(n));
  return loose ? join(dir, loose) : null;
}

function resolveSupplierId(
  name: string,
  suppliers: { id: string; name: string }[],
  cache: Map<string, string | null>
): string | null {
  const key = name.toUpperCase().trim();
  if (cache.has(key)) return cache.get(key) ?? null;
  const exact = suppliers.find((s) => s.name.toUpperCase().trim() === key);
  const id = exact?.id ?? matchSupplierId(name, suppliers);
  cache.set(key, id ?? null);
  return id ?? null;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const fresh = process.argv.includes("--fresh");
  const skipExisting = process.argv.includes("--skip-existing");
  const backfillSuppliers = process.argv.includes("--backfill-suppliers");
  const rebuildSchedules =
    process.argv.includes("--rebuild-schedules") ||
    (fresh && !process.argv.includes("--no-rebuild-schedules"));
  const syncScheduleTabs =
    process.argv.includes("--sync-schedule-tabs") ||
    (rebuildSchedules && !process.argv.includes("--no-sync-schedule-tabs"));
  const input = args[0];
  if (!input) {
    console.error(
      "Użycie: npx tsx scripts/import-historia-from-csv.ts <katalog-lub-plik.csv> [--fresh]"
    );
    process.exit(1);
  }
  const dir = input.toLowerCase().endsWith(".csv") ? null : input;
  const singleCsv = input.toLowerCase().endsWith(".csv") ? input : null;
  if (!url || !key) {
    console.error("Ustaw NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: suppliers } = await supabase.from("suppliers").select("id, name");
  const supplierList = suppliers ?? [];
  const supplierIdByName = new Map(
    supplierList.map((s) => [s.name.toUpperCase().trim(), s.id])
  );
  const supplierMatchCache = new Map<string, string | null>();

  async function ensureImportSuppliers() {
    const missing = ["Laboral"];
    for (const name of missing) {
      if (supplierList.some((s) => s.name.toUpperCase() === name.toUpperCase())) continue;
      const { data, error } = await supabase
        .from("suppliers")
        .upsert(
          {
            name,
            location: "ZAGRANICA",
            pickup_mikran: false,
            pickup_pallet: false,
            notes: "MAILOWO",
            mails: "",
            extra_info: "",
            interval_raw: "3 MIESIĄCE",
            interval_weeks: 12,
            stock_raw: "2 MIESIĄCE",
            stock: 8,
            stats_mode: "LACZNIE",
          },
          { onConflict: "name" }
        )
        .select("id, name")
        .single();
      if (error) {
        console.warn("Dostawca", name, error.message);
        continue;
      }
      if (data) {
        supplierList.push(data);
        supplierIdByName.set(data.name.toUpperCase().trim(), data.id);
        await supabase
          .from("supplier_schedules")
          .upsert({ supplier_id: data.id }, { onConflict: "supplier_id" });
        console.log(`Dodano dostawcę: ${name}`);
      }
    }
  }

  const historiaPath = singleCsv
    ? isIndividualHistoriaFile(singleCsv)
      ? null
      : singleCsv
    : dir
      ? findHistoriaCsv(dir, "standard")
      : null;
  const indywPath = singleCsv
    ? isIndividualHistoriaFile(singleCsv)
      ? singleCsv
      : null
    : dir
      ? findHistoriaCsv(dir, "individual")
      : null;

  let normalCount = 0;
  const unmatchedSuppliers = new Set<string>();

  const standardImportOnly =
    historiaPath && !(backfillSuppliers && !fresh && !skipExisting);

  if (standardImportOnly) {
    if (fresh) {
      const { error: delErr } = await supabase
        .from("normal_order_history")
        .delete()
        .gte("action_at", "1970-01-01");
      if (delErr) {
        console.warn("Nie usunięto starej historii:", delErr.message);
      } else {
        console.log("Wyczyszczono poprzednią historię standardową (--fresh).");
      }
    }

    const grid = parseCsv(readFileSync(historiaPath, "utf-8"));
    if (grid.length > 1) {
      const h = grid[0];
      const actionAtI = headerIndex(h, "DATA AKCJI", "DATA", "ACTION_AT", "CZAS");
      const userI = headerIndex(h, "UŻYTKOWNIK", "UZYTKOWNIK", "EMAIL", "USER", "MAIL");
      const supplierI = headerIndex(h, "DOSTAWCA", "DOSTAWCY", "SUPPLIER");
      const actionI = headerIndex(h, "AKCJA", "ACTION", "Zdarzenie");
      const nextI = headerIndex(
        h,
        "DATA NAST. ZAM.",
        "DATA NAST",
        "NASTĘPNA DATA",
        "NEXT_DATE",
        "TERMIN"
      );

      const batch: {
        supplier_id: string | null;
        action: string;
        user_email: string;
        action_at: string;
        next_date: string | null;
      }[] = [];

      const flush = async () => {
        if (!batch.length) return;
        const chunk = batch.splice(0, batch.length);
        const { error } = await supabase.from("normal_order_history").insert(chunk);
        if (error) throw new Error(error.message);
        normalCount += chunk.length;
      };

      for (let i = 1; i < grid.length; i++) {
        const row = grid[i];
        const supplierName = row[supplierI >= 0 ? supplierI : -1]?.trim();
        const sid = supplierName
          ? resolveSupplierId(supplierName, supplierList, supplierMatchCache)
          : null;
        if (supplierName && !sid) unmatchedSuppliers.add(supplierName);

        const action = row[actionI >= 0 ? actionI : -1]?.trim();
        if (!action) continue;

        const actionAtRaw = actionAtI >= 0 ? row[actionAtI]?.trim() : "";
        let action_at = new Date().toISOString();
        if (actionAtRaw) {
          const parsed = parseDateOnly(actionAtRaw.slice(0, 10));
          if (parsed) {
            const timePart = actionAtRaw.includes(" ")
              ? actionAtRaw.split(" ")[1]
              : "12:00:00";
            action_at = new Date(`${parsed.toISOString().slice(0, 10)}T${timePart}`).toISOString();
          } else {
            const d = new Date(actionAtRaw.replace(" ", "T"));
            if (!Number.isNaN(d.getTime())) action_at = d.toISOString();
          }
        }

        const userRaw = userI >= 0 ? row[userI]?.trim() : "";
        const user_email = userRaw.includes("@")
          ? userRaw
          : userRaw
            ? `${userRaw}@import.local`
            : "import@system.local";

        const nextRaw = nextI >= 0 ? row[nextI]?.trim() : "";
        const nextParsed = nextRaw ? parseDateOnly(nextRaw) : null;
        const next_date = nextParsed ? nextParsed.toISOString().slice(0, 10) : null;

        batch.push({
          supplier_id: sid,
          action,
          user_email,
          action_at,
          next_date,
        });
        if (batch.length >= 250) await flush();
      }
      await flush();
    }
    console.log(`Historia standardowa (${historiaPath}): ${normalCount} wpisów`);
    if (unmatchedSuppliers.size) {
      console.log(`Bez dopasowania dostawcy (${unmatchedSuppliers.size} nazw), przykłady:`);
      [...unmatchedSuppliers].slice(0, 20).forEach((n) => console.log(`  - ${n}`));
    }
  } else if (!historiaPath) {
    console.log("Brak pliku historia.csv w katalogu");
  }

  let indCount = 0;
  const indGrid =
    indywPath
      ? parseCsv(readFileSync(indywPath, "utf-8"))
      : dir
        ? loadCsv(dir, "historia_indywidualne.csv")
        : null;

  if (indGrid && indGrid.length > 1) {
    await ensureImportSuppliers();

    if (fresh) {
      const { error: delErr } = await supabase
        .from("individual_orders")
        .delete()
        .gte("created_at", "1970-01-01");
      if (delErr) {
        console.warn("Nie usunięto starych zamówień indywidualnych:", delErr.message);
      } else {
        console.log("Wyczyszczono poprzednie zamówienia indywidualne (--fresh).");
      }
    }

    const h = indGrid[0];
    const dateI =
      h.findIndex((c) => !c.trim()) === 0
        ? 0
        : headerIndex(h, "DATA", "DATA AKCJI", "DATA ZAMÓWIENIA");
    const typeI = headerIndex(h, "TYP ZAMÓWIENIA", "TYP", "ORDER_TYPE");
    const supplierI = headerIndex(h, "DOSTAWCA", "DOSTAWCY");
    const symbolI = headerIndex(h, "SYMBOL");
    const productsI = headerIndex(h, "PRODUKT", "PRODUKTY");
    const qtyI = headerIndex(h, "ILOŚĆ", "ILOSC", "ILOŚĆ ZAMÓWIONA");
    const deliveredI = headerIndex(
      h,
      "DOSTARCZONA ILOŚĆ",
      "DOSTARCZONO",
      "DOSTARCZONA",
      "DOSTARCZONA ILOSC"
    );
    const personI = headerIndex(h, "DLA KOGO", "OSOBA", "HANDLOWIEC", "FOR_WHOM");
    const statusI = headerIndex(h, "STATUS");
    const deliveryI = headerIndex(h, "DATA DOSTARCZENIA", "DATA DOSTAWY");
    const idI = headerIndex(h, "ID_ZAMÓWIENIA", "ID", "ID ZAMÓWIENIA");

    const allPersonLabels: string[] = [];
    for (let i = 1; i < indGrid.length; i++) {
      const label = indGrid[i][personI >= 0 ? personI : -1]?.trim();
      if (label) allPersonLabels.push(label);
    }
    const salesByName = await ensureSalesPeopleFromAliases(supabase, allPersonLabels);
    console.log(`Handlowcy (karty): ${salesByName.size}`);

    const statusMap: Record<string, string> = {
      Nowe: "Nowe",
      Zamówione: "Zamowione",
      Zrealizowane: "Zrealizowane",
      "Częściowo zrealizowane": "Czesciowo_zrealizowane",
      Anulowane: "Anulowane",
    };
    const orderTypeMap: Record<string, string> = {
      Główne: "Glowne",
      Glowne: "Glowne",
      Poboczne: "Poboczne",
      "-": "None",
      "": "None",
    };

    const skipped: string[] = [];
    const unmatchedSuppliersInd = new Set<string>();
    const batch: Record<string, unknown>[] = [];
    let skippedExisting = 0;
    let informacjaOnlyCount = 0;
    const stanSalesPersonId = salesByName.get("STAN") ?? null;

    const existingIds = new Set<string>();
    if (skipExisting) {
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data: existing, error: pageErr } = await supabase
          .from("individual_orders")
          .select("id")
          .range(from, from + pageSize - 1);
        if (pageErr) throw new Error(pageErr.message);
        if (!existing?.length) break;
        for (const row of existing) existingIds.add(row.id);
        if (existing.length < pageSize) break;
        from += pageSize;
      }
    }

    const flushInd = async () => {
      if (!batch.length) return;
      const chunk = batch.splice(0, batch.length);
      const { error } = await supabase.from("individual_orders").insert(chunk);
      if (error) throw new Error(error.message);
      indCount += chunk.length;
    };

    for (let i = 1; i < indGrid.length; i++) {
      const row = indGrid[i];
      const supplier = row[supplierI >= 0 ? supplierI : -1]?.trim();
      const person = row[personI >= 0 ? personI : -1]?.trim();
      const sid = supplier
        ? resolveSupplierId(supplier, supplierList, supplierMatchCache)
        : null;
      const sid = supplier
        ? resolveSupplierId(supplier, supplierList, supplierMatchCache)
        : null;
      const products = row[productsI >= 0 ? productsI : -1]?.trim() || "-";
      const quantityRaw = row[qtyI >= 0 ? qtyI : -1]?.trim() || "-";
      const asInformacjaPreview = shouldTreatAsInformacjaOnly({
        quantity: quantityRaw,
        personLabel: person,
        salesPersonId: null,
        stanSalesPersonId,
      });
      let pid = person ? resolveSalesPersonId(person, salesByName) : null;
      if (!pid && asInformacjaPreview && stanSalesPersonId) {
        pid = stanSalesPersonId;
      }

      if (!sid && supplier) unmatchedSuppliersInd.add(supplier);
      if (!sid || !pid) {
        if (skipped.length < 20) {
          skipped.push(`w.${i}: ${supplier ?? "?"} / ${person ?? "?"}`);
        }
        continue;
      }

      const statusRaw = statusI >= 0 ? row[statusI]?.trim() : "";
      const status = statusMap[statusRaw] || "Nowe";
      const typeRaw = typeI >= 0 ? row[typeI]?.trim() : "";
      const order_type = orderTypeMap[typeRaw] ?? "None";

      const dateRaw = dateI >= 0 ? row[dateI]?.trim() : "";
      const action_at = dateRaw
        ? (parseDateOnly(dateRaw)?.toISOString() ?? new Date(dateRaw).toISOString())
        : new Date().toISOString();

      const deliveryRaw = deliveryI >= 0 ? row[deliveryI]?.trim() : "";
      const delivery_at =
        deliveryRaw && deliveryRaw !== "-"
          ? parseDateOnly(deliveryRaw)?.toISOString()
          : null;

      const orderId = idI >= 0 ? row[idI]?.trim() : "";
      if (skipExisting && orderId && existingIds.has(orderId)) {
        skippedExisting++;
        continue;
      }
      const asInformacja = shouldTreatAsInformacjaOnly({
        quantity: quantityRaw,
        personLabel: person,
        salesPersonId: pid,
        stanSalesPersonId,
      });
      if (asInformacja) informacjaOnlyCount++;
      const informacjaAlreadyOrdered =
        asInformacja && (status === "Zamowione" || status === "Zrealizowane");

      batch.push({
        ...(orderId ? { id: orderId } : {}),
        supplier_id: sid,
        sales_person_id: pid,
        symbol: row[symbolI >= 0 ? symbolI : -1]?.trim() || "-",
        products,
        quantity: asInformacja ? INFORMACJA_NO_QUANTITY : quantityRaw,
        delivered_quantity: row[deliveredI >= 0 ? deliveredI : -1]?.trim() || "-",
        status,
        order_type: informacjaAlreadyOrdered ? order_type : asInformacja ? "None" : order_type,
        request_kind: asInformacja ? "informacja" : "zamowienie",
        informacja_queue_via_daily_panel: false,
        action_at,
        delivery_at,
        ordered_at:
          status === "Zamowione" || status === "Zrealizowane" ? action_at : null,
        ...(status === "Zrealizowane"
          ? { sales_acknowledged_at: delivery_at ?? action_at }
          : {}),
      });
      if (batch.length >= 100) await flushInd();
    }
    await flushInd();

    console.log(`Historia indywidualna (${indywPath}): ${indCount} wpisów`);
    if (informacjaOnlyCount) {
      console.log(
        `  → prośby informacyjne (ilość „-” lub handlowiec STAN): ${informacjaOnlyCount}`
      );
    }
    if (skipExisting && skippedExisting) {
      console.log(`Pominięte (już w bazie): ${skippedExisting}`);
    }
    if (unmatchedSuppliersInd.size) {
      console.log(`Bez dopasowania dostawcy (${unmatchedSuppliersInd.size}), przykłady:`);
      [...unmatchedSuppliersInd].slice(0, 15).forEach((n) => console.log(`  - ${n}`));
    }
    if (skipped.length) {
      console.log("Pominięte (brak dostawcy lub handlowca), przykłady:");
      skipped.forEach((s) => console.log(`  ${s}`));
    }
  } else if (indywPath || dir) {
    console.log("Brak pliku historia indywidualna w katalogu");
  }

  if (backfillSuppliers) {
    await ensureImportSuppliers();
    const pathForBackfill =
      historiaPath ?? (dir ? findHistoriaCsv(dir, "standard") : null);
    if (pathForBackfill) {
      await backfillNormalHistorySupplierIds(
        supabase,
        pathForBackfill,
        supplierList,
        supplierMatchCache
      );
    }
  }

  if (rebuildSchedules && (normalCount > 0 || fresh)) {
    console.log("Przeliczanie harmonogramów z historii (Zamówione / Zamówienie Główne / Przesunięte)…");
    const rebuilt = await rebuildAllSupplierSchedulesFromHistoria();
    console.log(`Harmonogramy z historii: ${rebuilt.updated} dostawców`);
    if (rebuilt.errors.length) {
      console.log(`Błędy harmonogramów (${rebuilt.errors.length}), przykłady:`);
      rebuilt.errors.slice(0, 15).forEach((e) => console.log(`  - ${e}`));
    }
  }

  if (syncScheduleTabs && dir) {
    console.log("Synchronizacja z zakładkami POLSKA/ZAGRANICA/IMPORT (stan bieżący z arkusza)…");
    const synced = await syncLocationSchedulesFromDir(supabase, dir);
    if (!synced.locations.length) {
      console.log("Brak plików *-POLSKA.csv / *-ZAGRANICA.csv / *-IMPORT.csv w katalogu — pominięto.");
    } else {
      console.log(`Zakładki lokalizacji: ${synced.updated} wierszy (${synced.locations.join(", ")})`);
    }
  }
}

async function backfillNormalHistorySupplierIds(
  supabase: ReturnType<typeof createClient>,
  historiaPath: string,
  supplierList: { id: string; name: string }[],
  cache: Map<string, string | null>
) {
  const grid = parseCsv(readFileSync(historiaPath, "utf-8"));
  if (grid.length < 2) return;

  const h = grid[0];
  const actionAtI = headerIndex(h, "DATA AKCJI", "DATA", "ACTION_AT", "CZAS");
  const userI = headerIndex(h, "UŻYTKOWNIK", "UZYTKOWNIK", "EMAIL", "USER", "MAIL");
  const supplierI = headerIndex(h, "DOSTAWCA", "DOSTAWCY", "SUPPLIER");
  const actionI = headerIndex(h, "AKCJA", "ACTION", "Zdarzenie");

  const { data: nullRows } = await supabase
    .from("normal_order_history")
    .select("id, action_at, user_email, action")
    .is("supplier_id", null);
  if (!nullRows?.length) return;

  const csvByKey = new Map<string, string>();
  for (let i = 1; i < grid.length; i++) {
    const row = grid[i];
    const actionAtRaw = actionAtI >= 0 ? row[actionAtI]?.trim() : "";
    let action_at = "";
    if (actionAtRaw) {
      const parsed = parseDateOnly(actionAtRaw.slice(0, 10));
      if (parsed) {
        const timePart = actionAtRaw.includes(" ")
          ? actionAtRaw.split(" ")[1]
          : "12:00:00";
        action_at = new Date(`${parsed.toISOString().slice(0, 10)}T${timePart}`).toISOString();
      } else {
        const d = new Date(actionAtRaw.replace(" ", "T"));
        if (!Number.isNaN(d.getTime())) action_at = d.toISOString();
      }
    }
    const userRaw = userI >= 0 ? row[userI]?.trim() : "";
    const user_email = userRaw.includes("@")
      ? userRaw
      : userRaw
        ? `${userRaw}@import.local`
        : "import@system.local";
    const action = row[actionI >= 0 ? actionI : -1]?.trim() ?? "";
    const supplierName = row[supplierI >= 0 ? supplierI : -1]?.trim() ?? "";
    if (!action_at || !action) continue;
    csvByKey.set(`${action_at}|${user_email}|${action}`, supplierName);
  }

  let updated = 0;
  for (const row of nullRows) {
    const supplierName = csvByKey.get(
      `${row.action_at}|${row.user_email}|${row.action}`
    );
    if (!supplierName) continue;
    const sid = resolveSupplierId(supplierName, supplierList, cache);
    if (!sid) continue;
    const { error } = await supabase
      .from("normal_order_history")
      .update({ supplier_id: sid })
      .eq("id", row.id);
    if (!error) updated++;
  }
  if (updated) console.log(`Historia standardowa — uzupełniono dostawcę: ${updated} wpisów`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
