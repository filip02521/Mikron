// Backtest roczny (BT_DATA=data-1y): 365 dni od 23.10.2025 na prawdziwej sprzedaży.
// Względem sim.mjs: czas dostawy jak silnik (p90 nearest-rank z próbek 24 mies. sprzed decyzji,
// dni robocze → kalendarzowe), realizacja = próbka zamówienia złożonego najbliżej dnia decyzji,
// zaokrąglenie do opakowań i wielokrotności z Kreatora (zd_estimate_packaging), wyniki per kwartał.
import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(HERE, process.env.BT_DATA ?? "data-1y");
const SIM_START = process.env.BT_SIM_FROM ?? "2025-10-23";
const SIM_DAYS = Number(process.env.BT_SIM_DAYS ?? 365);
const DAY = 86400000;
const toIdx = (k) => Math.round((Date.parse(k + "T12:00:00Z") - Date.parse(SIM_START + "T12:00:00Z")) / DAY);
const keyOf = (i) => new Date(Date.parse(SIM_START + "T12:00:00Z") + i * DAY).toISOString().slice(0, 10);

/** Dni robocze → kalendarzowe od dnia `fromKey` (weekendy; bez świąt — przybliżenie). */
export function businessToCalendar(fromKey, bd) {
  const d = new Date(fromKey + "T12:00:00Z");
  let left = Math.max(0, Math.round(bd)), cal = 0;
  while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); cal++; const w = d.getUTCDay(); if (w !== 0 && w !== 6) left--; }
  return cal;
}
export const nearestRank = (sorted, p) => (sorted.length ? sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] : null);

/** Jak silnik: próbki z 24 mies. przed dniem (min. 5 najnowszych); p90 od 5 próbek, inaczej p50, inaczej 7 dni. */
export function leadAt(samples, dayKey) {
  const before = samples.filter((s) => s.d < dayKey).sort((a, b) => b.d.localeCompare(a.d));
  const cut = new Date(dayKey + "T12:00:00Z"); cut.setUTCMonth(cut.getUTCMonth() - 24);
  const cutKey = cut.toISOString().slice(0, 10);
  let win = before.filter((s) => s.d >= cutKey);
  if (win.length < 5) win = before.slice(0, 5);
  const pick = (s) => (process.env.BT_LEAD === "first" ? Math.min(s.bd, s.bf ?? s.bd) : s.bd);
  const bd = win.map(pick).sort((a, b) => a - b);
  const p = bd.length >= 5 ? nearestRank(bd, 0.9) : bd.length ? nearestRank(bd, 0.5) : null;
  return p == null ? 7 : businessToCalendar(dayKey, p);
}
/** Realizacja zamówienia złożonego w dniu `dayKey`: próbka prawdziwego zamówienia najbliżej tej daty. */
export function realizedLead(samples, dayKey) {
  if (!samples.length) return 7;
  let best = samples[0], bestD = Infinity;
  const t = Date.parse(dayKey);
  for (const s of samples) { const dd = Math.abs(Date.parse(s.d) - t); if (dd < bestD) { bestD = dd; best = s; } }
  const bd = process.env.BT_ARRIVAL === "first" ? Math.min(best.bd, best.bf ?? best.bd) : best.bd;
  return Math.max(1, businessToCalendar(dayKey, bd));
}
/** Jak computeZdPackOrderQty: sztuki w górę do opakowania; w trybie paczek też do wielokrotności paczek. */
export function packRound(pieces, pack) {
  const p = Math.max(0, Math.ceil(pieces - 1e-9));
  if (!p || !pack || !(pack[0] > 1)) return p;
  const [units, mode, mult] = pack;
  let packs = Math.ceil(p / units);
  if (mode === "packages" && mult > 1) packs = Math.ceil(packs / mult) * mult;
  return packs * units;
}

const VARIANTS = [
  ["P0 Kreator 30 d", { kind: "P0", dni: 30 }],
  ["P0 45 d", { kind: "P0", dni: 45 }],
  ["P0 60 d", { kind: "P0", dni: 60 }],
  ["P2 cykl dostawcy", { kind: "P2", target: 25 }],
  ["P2 R7 cel 20", { kind: "P2", R: 7, target: 20 }],
  ["P2 R7 cel 25 ★", { kind: "P2", R: 7, target: 25 }],
  ["P2 R7 cel 30", { kind: "P2", R: 7, target: 30 }],
  ["P2 R3 cel 25", { kind: "P2", R: 3, target: 25 }],
  ["P2 R14 cel 25", { kind: "P2", R: 14, target: 25 }],
  ["P2 R21 cel 25", { kind: "P2", R: 21, target: 25 }],
  ["P2 R7 bez podłogi 90", { kind: "P2", R: 7, target: 25, noFloor: true }],
];

/**
 * Popyt dzienny towaru: sprzedaż + (komplety „explode”) sprzedaż kompletu × ilość składnika
 * + (BT_OUTFLOW=1) rozchód bez sprzedaży z bilansu remanentów — test odporności na lukę w danych.
 */
function demandLines(ds, bomByComponent, explodeParents) {
  const out = new Map();
  for (const p of ds.products) out.set(p.id, (ds.sales[p.id] ?? []).map(([k, q]) => [toIdx(k), q]).filter(([, q]) => q > 0));
  for (const [comp, parents] of bomByComponent) {
    if (!out.has(comp)) continue;
    for (const [parent, qty] of parents) for (const [k, q] of ds.sales[parent] ?? []) if (q > 0) out.get(comp).push([toIdx(k), q * qty]);
  }
  if (process.env.BT_OUTFLOW === "1") {
    const days = Object.keys(ds.stock).sort();
    for (const p of ds.products) {
      const lines = out.get(p.id);
      for (let i = 0; i + 1 < days.length; i++) {
        const a = toIdx(days[i]), b = toIdx(days[i + 1]);
        const qa = ds.stock[days[i]][p.id]?.[0] ?? 0, qb = ds.stock[days[i + 1]][p.id]?.[0] ?? 0;
        const sold = lines.filter(([d]) => d > a && d <= b).reduce((x, [, q]) => x + q, 0);
        const hidden = -(qb - qa + sold);
        if (hidden > 1e-9) for (let d = a + 1; d <= b; d++) lines.push([d, hidden / (b - a)]);
      }
    }
  }
  for (const id of explodeParents) out.delete(id);
  return out;
}

function simulate(ds, v, sup, packaging, demand) {
  const R = v.R ?? (sup.interval_weeks || 1) * 7;
  const samples = sup.lead ?? [];
  const start = ds.stock[Object.keys(ds.stock).sort()[0]] ?? {};
  const snapDays = new Set(Object.keys(ds.stock).map(toIdx));
  const res = { dV: 0, sV: 0, oos: 0, sd: 0, stockV: 0, orders: new Map(), q: [0, 0, 0, 0].map(() => ({ dV: 0, sV: 0, oos: 0, sd: 0, stockV: 0 })), snapOos: 0, snapN: 0, units: 0 };
  // Te same daty decyzji dla wszystkich towarów dostawcy
  const leadCache = new Map(), realCache = new Map();
  for (const p of ds.products) {
    if (!p.cost || !demand.has(p.id)) continue;
    const lines = demand.get(p.id);
    const daily = new Array(SIM_DAYS).fill(0);
    for (const [i, q] of lines) if (i >= 0 && i < SIM_DAYS) daily[i] += q;
    let stock = Math.max(0, start[p.id]?.[0] ?? 0);
    const pipe = new Map();
    const pack = packaging[p.id] ?? null;
    for (let t = 0; t < SIM_DAYS; t++) {
      stock += pipe.get(t) ?? 0; pipe.delete(t);
      if (snapDays.has(t) && p.active) { res.snapN++; if (stock <= 0) res.snapOos++; }
      if (t % R === 0) {
        const day = keyOf(t);
        if (!leadCache.has(t)) { leadCache.set(t, leadAt(samples, day)); realCache.set(t, realizedLead(samples, day)); }
        const L90 = leadCache.get(t);
        const onOrder = [...pipe.values()].reduce((a, b) => a + b, 0);
        const sumWin = (n) => lines.filter(([i]) => i < t && i >= t - n).reduce((a, [, q]) => a + q, 0);
        let target;
        if (v.kind === "P0") target = (sumWin(v.dni) / v.dni) * v.dni; // Kreator: okno = dni zapasu
        else {
          const rate = v.noFloor ? sumWin(30) / 30 : Math.max(sumWin(30) / 30, sumWin(90) / 90);
          target = rate * Math.max(v.target, R + L90 + Math.round(L90 * 0.25));
        }
        const need = target - stock - onOrder;
        const qty = need > 1e-9 ? packRound(need, pack) : 0;
        if (qty > 0) {
          const arr = t + realCache.get(t);
          pipe.set(arr, (pipe.get(arr) ?? 0) + qty);
          res.orders.set(t, (res.orders.get(t) ?? 0) + qty * p.cost);
          res.units += qty;
        }
      }
      const d = daily[t], served = Math.min(stock, d);
      stock -= served;
      const qq = res.q[Math.min(3, Math.floor((t / SIM_DAYS) * 4))];
      for (const o of [res, qq]) { o.dV += d * p.cost; o.sV += served * p.cost; o.stockV += stock * p.cost; if (p.active) { o.sd++; if (stock <= 0 || d > served) o.oos++; } }
    }
  }
  return res;
}

function reality(ds) {
  const days = Object.keys(ds.stock).sort();
  let oos = 0, n = 0, v = 0;
  for (const p of ds.products) {
    if (!p.cost) continue;
    for (const k of days) { const q = ds.stock[k][p.id]?.[0] ?? 0; v += (q * p.cost) / days.length; if (p.active) { n++; if (q <= 0) oos++; } }
  }
  return { oos, n, v };
}

export function load(file) {
  const ds = JSON.parse(fs.readFileSync(file, "utf8"));
  const cs = new Map();
  for (const k of Object.keys(ds.stock).sort()) for (const [id, [, c]] of Object.entries(ds.stock[k])) if (c > 0 && !cs.has(+id)) cs.set(+id, c);
  const cm = new Map(ds.margin.filter((m) => m.qty > 0 && m.koszt > 0).map((m) => [m.id, m.koszt / m.qty]));
  const from6 = keyOf(-182);
  for (const p of ds.products) {
    p.cost = cs.get(p.id) ?? cm.get(p.id) ?? null;
    p.active = (ds.sales[p.id] ?? []).some(([k, q]) => q > 0 && k >= from6 && k < SIM_START);
  }
  return ds;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const sups = JSON.parse(fs.readFileSync(path.join(DIR, "suppliers-lead.json"), "utf8"));
  const packaging = JSON.parse(fs.readFileSync(path.join(DIR, "packaging.json"), "utf8"));
  const bom = fs.existsSync(path.join(DIR, "bom.json")) ? JSON.parse(fs.readFileSync(path.join(DIR, "bom.json"), "utf8")) ?? [] : [];
  const explodeParents = new Set(bom.filter((b) => b[3] === "components").map((b) => b[0]));
  const bomByComponent = new Map();
  for (const [parent, comp, qty, target] of bom) if (target === "components") bomByComponent.set(comp, [...(bomByComponent.get(comp) ?? []), [parent, Number(qty) || 1]]);
  console.log(`komplety explode: ${explodeParents.size}, składniki: ${bomByComponent.size}; BT_OUTFLOW=${process.env.BT_OUTFLOW ?? "0"}`);
  // BT_EXCLUDE=2738 — pomiń zakresy (cecha) z listy, np. dostawcę oznaczonego w OnTime jako ZAGRANICA.
  const exclude = new Set(String(process.env.BT_EXCLUDE ?? "").split(",").filter(Boolean));
  const files = fs.readdirSync(DIR).filter((f) => /^\d+\.json$/.test(f) && !exclude.has(f.replace(".json", "")));
  const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + "%" : "—");
  const mln = (x) => (x / 1e6).toFixed(2);
  const tot = Object.fromEntries(VARIANTS.map(([n]) => [n, { dV: 0, sV: 0, oos: 0, sd: 0, stockV: 0, nOrd: 0, ordV: [], snapOos: 0, snapN: 0, q: [0, 0, 0, 0].map(() => ({ dV: 0, sV: 0, oos: 0, sd: 0, stockV: 0 })) }]));
  const real = { oos: 0, n: 0, v: 0 };
  const per = [];
  for (const f of files) {
    const ds = load(path.join(DIR, f));
    const sup = sups.find((s) => s.cecha_id === ds.supplier.cecha_id);
    const r = reality(ds); real.oos += r.oos; real.n += r.n; real.v += r.v;
    const demand = demandLines(ds, bomByComponent, explodeParents);
    const row = { name: sup.name, real: r };
    for (const [n, v] of VARIANTS) {
      const s = simulate(ds, v, sup, packaging, demand); row[n] = s;
      const t = tot[n]; for (const k of ["dV", "sV", "oos", "sd", "snapOos", "snapN"]) t[k] += s[k];
      t.stockV += s.stockV / SIM_DAYS; t.nOrd += s.orders.size; t.ordV.push(...s.orders.values());
      s.q.forEach((qq, i) => { for (const k of ["dV", "sV", "oos", "sd"]) t.q[i][k] += qq[k]; t.q[i].stockV += qq.stockV / (SIM_DAYS / 4); });
    }
    per.push(row);
  }
  console.log(`BACKTEST ROCZNY ${SIM_START} + ${SIM_DAYS} d · ${files.length} dostawców\n`);
  console.log("wariant | sprzedaż obsłużona | dni z brakiem | zero na zdjęciu tyg. | śr. zapas mln | ZD | mediana ZD zł");
  console.log(`Rzeczywistość | — | — | ${pct(real.oos, real.n)} | ${mln(real.v)} | — | —`);
  for (const [n] of VARIANTS) { const t = tot[n]; const o = [...t.ordV].sort((a, b) => a - b); console.log(`${n} | ${pct(t.sV, t.dV)} | ${pct(t.oos, t.sd)} | ${pct(t.snapOos, t.snapN)} | ${mln(t.stockV)} | ${t.nOrd} | ${Math.round(o[Math.floor(o.length / 2)] ?? 0)}`); }
  console.log("\nKWARTAŁY (dni z brakiem / śr. zapas mln):");
  for (const [n] of VARIANTS) console.log(n, "|", tot[n].q.map((qq, i) => `Q${i + 1} ${pct(qq.oos, qq.sd)} ${mln(qq.stockV)}`).join(" | "));
  console.log("\nDOSTAWCY (zero na zdjęciu tyg. / śr. zapas tys.): real | P0 30 | P0 60 | P2 R7 ★ | P2 R3");
  const k = (s) => `${pct(s.snapOos, s.snapN)} ${Math.round(s.stockV / SIM_DAYS / 1000)}`;
  for (const r of per) console.log(r.name, "|", pct(r.real.oos, r.real.n), Math.round(r.real.v / 1000), "|", k(r["P0 Kreator 30 d"]), "|", k(r["P0 60 d"]), "|", k(r["P2 R7 cel 25 ★"]), "|", k(r["P2 R3 cel 25"]));
  const star = "P2 R7 cel 25 ★";
  const win = per.filter((r) => r[star].snapOos / r[star].snapN <= r.real.oos / r.real.n && r[star].stockV / SIM_DAYS <= r.real.v).length;
  console.log(`\n${star}: nie gorszy od rzeczywistości w brakach I zapasie u ${win}/${per.length}`);
}
