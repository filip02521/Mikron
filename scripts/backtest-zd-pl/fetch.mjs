// Backtest ZD (polscy dostawcy) — pobranie danych: tylko GET do Subiekta, zapis do ./data/<cecha>.json
// (data/ jest w .gitignore — zawiera id dokumentów i kontrahentów).
// Wejście ./data/suppliers.json z bazy OnTime (psql "$DATABASE_URL" -At -c "select json_agg(x) from (
//   select s.name, s.subiekt_kh_id kh, s.interval_weeks, s.min_order_value, z.cecha_id,
//   (select json_agg(d.business_days_full order by d.placement_date) from delivery_stats_samples d
//    where d.supplier_id = s.id and d.order_type = 'Glowne' and d.placement_date >= '2025-01-01') lead_bd
//   from suppliers s join zd_estimate_supplier_scopes z on z.supplier_id = s.id
//   where s.subiekt_kh_id in (...)) x" > data/suppliers.json)
// Potem: node sim.check.mjs && node sim.mjs. Wyniki: docs/integrations/strategia-zakupowa-pl-automatyzacja.md §8.
import fs from "node:fs";
import path from "node:path";

const B = "http://192.168.0.140:5080/api/v1";
// BT_DATA=data-1y BT_SALES_FROM=2024-10-01 BT_SIM_START=2025-10-22 node fetch.mjs — backtest roczny
const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), process.env.BT_DATA ?? "data");
const SALES_FROM = process.env.BT_SALES_FROM ?? "2025-04-01";
const SALES_TO = process.env.BT_SALES_TO ?? "2026-10-22";
const SIM_START = process.env.BT_SIM_START ?? "2026-04-22"; // stock on this day = start position
const TRAIN_FROM = (() => { const d = new Date(SIM_START + "T12:00:00Z"); d.setUTCFullYear(d.getUTCFullYear() - 1); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();

async function get(url, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(B + url, { signal: AbortSignal.timeout(120000) });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
async function paged(url, pick, pageSize = 200) {
  const out = [];
  let page = 1, total = 1, count = null;
  do {
    const j = await get(`${url}${url.includes("?") ? "&" : "?"}page=${page}&pageSize=${pageSize}`);
    out.push(...pick(j));
    total = j.pagination?.totalPages ?? 1;
    count = j.pagination?.totalCount ?? count;
    page++;
  } while (page <= total);
  if (count != null && out.length !== count) console.warn(`WARN count ${out.length}/${count} ${url}`);
  return out;
}
async function pool(items, n, fn) {
  const res = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); }
  }));
  return res;
}
function weeklyDates() {
  const out = [];
  const d = new Date(SIM_START + "T12:00:00Z");
  const end = new Date(SALES_TO + "T12:00:00Z");
  while (d <= end) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 7); }
  return out;
}

const suppliers = JSON.parse(fs.readFileSync(path.join(DIR, "suppliers.json"), "utf8"));
for (const s of suppliers) {
  const file = path.join(DIR, `${s.cecha_id}.json`);
  if (fs.existsSync(file)) { console.log("skip", s.name); continue; }
  const t0 = Date.now();
  const products = await paged(`/products?cechaId=${s.cecha_id}`, (j) => j.data ?? []);
  const ids = [...new Set(products.map((p) => p.tw_Id))];
  const sales = {};
  await pool(ids, 6, async (tw) => {
    const docs = await paged(
      `/orders/zd/estimate/${tw}?dataOd=${SALES_FROM}&dataDo=${SALES_TO}`,
      (j) => j.data?.dokumenty ?? []
    );
    sales[tw] = docs
      .filter((d) => d.wSkladnik === "sprzedazOkres")
      .map((d) => [d.dok_DataWyst.slice(0, 10), d.ob_Ilosc, d.dok_Id, d.kontrahentId, d.rola]);
  });
  const stock = {};
  for (const day of weeklyDates()) {
    const rows = await paged(`/products/remanent?naDzien=${day}&cechaId=${s.cecha_id}`, (j) => j.data?.pozycje ?? []);
    stock[day] = Object.fromEntries(rows.map((r) => [r.tw_Id, [r.ilosc, r.cenaMag]]));
  }
  const margin = await paged(
    `/reports/sprzedaz/asortyment?dataOd=${TRAIN_FROM}&dataDo=${SIM_START}&cechaId=${s.cecha_id}&zDetalem=true`,
    (j) => j.data?.items ?? [], 500
  );
  fs.writeFileSync(file, JSON.stringify({
    supplier: s,
    products: products.map((p) => ({ id: p.tw_Id, sym: p.tw_Symbol, name: p.tw_Nazwa, blocked: p.tw_Zablokowany })),
    sales, stock,
    margin: margin.map((m) => ({ id: m.towarId, qty: m.ilosc, netto: m.netto, koszt: m.koszt, zysk: m.zysk })),
  }));
  console.log(s.name, "products", ids.length, "s", Math.round((Date.now() - t0) / 1000));
}
console.log("DONE");
