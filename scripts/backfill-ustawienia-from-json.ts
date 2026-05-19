/**
 * Uzupełnia interval_raw i stock_raw z data/ustawienia.json
 * oraz z harmonogramów POLSKA/ZAGRANICA gdy zapas w USTAWIENIACH jest pusty lub błędny.
 *
 * npx tsx scripts/backfill-ustawienia-from-json.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { intervalWeeksForStorage, parseInterval } from "../src/lib/orders/dates";
import { detectOrderOnDemandFromFields } from "../src/lib/orders/supplier-on-demand";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type UstawieniaRow = {
  name: string;
  interval_raw: string;
  stock_raw: string;
  extra_info?: string;
};

type ScheduleRow = { name: string; stock_raw?: string };

function isValidStockRaw(v: string | undefined | null): boolean {
  const t = (v ?? "").trim();
  if (!t) return false;
  if (/w razie potrzeby/i.test(t)) return true;
  if (/@/.test(t) || /^tel[.:]?/i.test(t) || /^:?\s*\d{9,}/.test(t)) return false;
  if (parseInterval(t)) return true;
  if (/miesi|tyg|rok|kwartal|pol roku|pół roku|miesiac/i.test(t)) return true;
  return false;
}

function pickStockRaw(
  fromSettings: string,
  fromSchedule: string | undefined
): string {
  const settings = (fromSettings ?? "").trim();
  const schedule = (fromSchedule ?? "").trim();
  if (isValidStockRaw(settings)) return settings;
  if (isValidStockRaw(schedule)) return schedule;
  return settings || schedule;
}

function loadScheduleStockMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of ["polska-schedules.json", "zagranica-schedules.json"]) {
    const path = join(process.cwd(), "data", file);
    if (!existsSync(path)) continue;
    const rows = JSON.parse(readFileSync(path, "utf-8")) as ScheduleRow[];
    for (const r of rows) {
      const s = r.stock_raw?.trim();
      if (!s || !isValidStockRaw(s)) continue;
      const prev = map.get(r.name);
      if (!prev || !isValidStockRaw(prev)) map.set(r.name, s);
    }
  }
  return map;
}

async function main() {
  if (!url || !key) {
    console.error("Ustaw NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const rows = JSON.parse(
    readFileSync(join(process.cwd(), "data", "ustawienia.json"), "utf-8")
  ) as UstawieniaRow[];

  const scheduleStock = loadScheduleStockMap();
  const supabase = createClient(url, key);

  let ok = 0;
  let missing = 0;
  let stockFromSchedule = 0;
  let stockFixed = 0;

  for (const r of rows) {
    const intervalParsed = parseInterval(r.interval_raw);
    const settingsStock = (r.stock_raw ?? "").trim();
    const scheduleFallback = scheduleStock.get(r.name);
    const stockRaw = pickStockRaw(settingsStock, scheduleFallback);
    if (scheduleFallback && stockRaw === scheduleFallback && !isValidStockRaw(settingsStock)) {
      stockFromSchedule++;
    }
    if (stockRaw && stockRaw !== settingsStock && isValidStockRaw(stockRaw)) {
      stockFixed++;
    }

    const stockParsed = parseInterval(stockRaw);

    const orderOnDemand = detectOrderOnDemandFromFields({
      stock_raw: stockRaw,
      interval_raw: r.interval_raw,
      extra_info: r.extra_info,
    });

    const { data, error } = await supabase
      .from("suppliers")
      .update({
        interval_raw: r.interval_raw || "",
        interval_weeks: intervalWeeksForStorage(r.interval_raw, intervalParsed),
        stock_raw: stockRaw,
        stock: intervalWeeksForStorage(stockRaw, stockParsed),
        order_on_demand: orderOnDemand,
        updated_at: new Date().toISOString(),
      })
      .eq("name", r.name)
      .select("id");

    if (error) {
      if (error.message.includes("stock_raw")) {
        console.error("Brak kolumny stock_raw — uruchom migrację 003_stock_raw.sql");
        process.exit(1);
      }
      console.warn(r.name, error.message);
      missing++;
    } else if (!data?.length) {
      missing++;
    } else ok++;
  }

  const withStock = rows.filter((r) => pickStockRaw(r.stock_raw, scheduleStock.get(r.name))?.trim())
    .length;

  console.log(`Zaktualizowano: ${ok}/${rows.length}`);
  console.log(`W JSON z zapasem (po walidacji): ${withStock}, brak w bazie: ${missing}`);
  console.log(`Zapas z harmonogramów PDF: ${stockFromSchedule}, poprawiono błędny z USTAWIEŃ: ${stockFixed}`);
}

main().catch(console.error);
