// Weryfikacja danych backtestu rocznego (BT_DATA=data-1y): czy sprzedaż, stany i ceny są kompletne.
// V1 bilans magazynu: stan(t+7) − stan(t) + sprzedaż(t, t+7] = przyjęcia. Ujemne „przyjęcia” = rozchód,
//    którego nie widzimy w sprzedaży (RW, MM, kompletacja) → popyt w symulacji zaniżony.
// V2 nasza sprzedaż (FS+PA+WZ niepowiązane) vs raport asortymentowy (FS+KFS+ZW+PA) w roku uczenia.
// V3 pokrycie: towary bez ceny, bez stanu startowego, linie ujemne.
import fs from "node:fs";
import path from "node:path";
import { load } from "./sim1y.mjs";

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), process.env.BT_DATA ?? "data-1y");
const SIM_START = process.env.BT_SIM_FROM ?? "2025-10-23";
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + "%" : "—");
const files = fs.readdirSync(DIR).filter((f) => /^\d+\.json$/.test(f));
const T = { sales: 0, neg: 0, recPos: 0, weeks: 0, negWeeks: 0, ourTrain: 0, asoTrain: 0, skus: 0, noCost: 0, active: 0, negLines: 0, lines: 0, salesV: 0, negV: 0 };
console.log("dostawca | SKU (bez ceny) | aktywne | sprzedaż roku szt | ukryty rozchód szt (% sprzedaży) | tyg. z ujemnym bilansem | nasza vs asortyment (rok uczenia)");
for (const f of files) {
  const ds = load(path.join(DIR, f));
  const days = Object.keys(ds.stock).sort();
  const s = { sales: 0, neg: 0, weeks: 0, negWeeks: 0, recPos: 0, salesV: 0, negV: 0 };
  const byDay = new Map();
  for (const p of ds.products) {
    const m = new Map();
    for (const [k, q] of ds.sales[p.id] ?? []) { T.lines++; if (q < 0) T.negLines++; m.set(k, (m.get(k) ?? 0) + q); }
    byDay.set(p.id, m);
  }
  for (let i = 0; i + 1 < days.length; i++) {
    const a = days[i], b = days[i + 1];
    for (const p of ds.products) {
      const qa = ds.stock[a][p.id]?.[0] ?? 0, qb = ds.stock[b][p.id]?.[0] ?? 0;
      let sold = 0;
      for (const [k, q] of byDay.get(p.id)) if (k > a && k <= b) sold += q;
      const rec = qb - qa + sold;
      if (qa === 0 && qb === 0 && sold === 0) continue;
      s.weeks++; s.sales += sold; s.salesV += sold * (p.cost ?? 0);
      if (rec < -1e-9) { s.neg += -rec; s.negV += -rec * (p.cost ?? 0); s.negWeeks++; } else s.recPos += rec;
    }
  }
  // V2: rok przed startem
  const trainFrom = (() => { const d = new Date(SIM_START + "T12:00:00Z"); d.setUTCFullYear(d.getUTCFullYear() - 1); return d.toISOString().slice(0, 10); })();
  let our = 0;
  for (const p of ds.products) for (const [k, q] of ds.sales[p.id] ?? []) if (k >= trainFrom && k < SIM_START) our += q;
  const aso = ds.margin.reduce((x, m) => x + m.qty, 0);
  const noCost = ds.products.filter((p) => !p.cost).length;
  const active = ds.products.filter((p) => p.active).length;
  console.log(`${ds.supplier.name} | ${ds.products.length} (${noCost}) | ${active} | ${Math.round(s.sales)} | ${Math.round(s.neg)} (${pct(s.neg, s.sales)}) | ${pct(s.negWeeks, s.weeks)} | ${Math.round(our)} vs ${Math.round(aso)} (${pct(our, aso)})`);
  for (const k of ["sales", "neg", "weeks", "negWeeks", "recPos", "salesV", "negV"]) T[k] += s[k];
  T.ourTrain += our; T.asoTrain += aso; T.skus += ds.products.length; T.noCost += noCost; T.active += active;
}
console.log(`\nRAZEM: SKU ${T.skus}, bez ceny ${T.noCost} (${pct(T.noCost, T.skus)}), aktywne ${T.active}`);
console.log(`V1 ukryty rozchód: ${Math.round(T.neg)} szt = ${pct(T.neg, T.sales)} sprzedaży (wartościowo ${pct(T.negV, T.salesV)}); tygodnie-SKU z ujemnym bilansem ${pct(T.negWeeks, T.weeks)}`);
console.log(`V2 nasza sprzedaż / asortyment (rok uczenia): ${pct(T.ourTrain, T.asoTrain)}`);
console.log(`V3 linie ujemne (zwroty/korekty) w danych: ${T.negLines} z ${T.lines} (${pct(T.negLines, T.lines)})`);
