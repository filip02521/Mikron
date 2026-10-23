// Backtest: replay 26 weeks of real sales against two ordering policies.
// P0 = Kreator today (cel = sprzedaż ostatnich 30 dni, dniZapasu 30, bez opcji)
// P2 = max30_90 (zd-demand-policy.ts) z cyklem R
// P1 = nowy wzór (R,S) z ABC (marża) × XYZ, przycinaniem pików, sufitem, EOQ-cap dla C
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "data");
const SIM_START = "2026-04-23";
const SIM_DAYS = 183;
const DAY = 86400000;
const toIdx = (k) => Math.round((Date.parse(k + "T12:00:00Z") - Date.parse(SIM_START + "T12:00:00Z")) / DAY);

const Z = { AX: 2.05, AY: 1.88, AZ: 1.65, BX: 1.88, BY: 1.65, BZ: 1.28, CX: 1.65, CY: 1.28, CZ: 1.28 };
const EOQ_K = 25, EOQ_I = 0.2;

export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
export const quantile = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const p = (s.length - 1) * q; const lo = Math.floor(p); return s[lo] + (s[Math.ceil(p)] - s[lo]) * (p - lo); };
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const std = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };

/** weekly buckets of the 364 days before day t, trimmed for single-document peaks */
export function demandStats(lines, t) {
  const weeks = Array.from({ length: 52 }, () => ({ q: 0, docs: new Map() }));
  let firstSale = null;
  for (const [i, q, doc] of lines) {
    if (i >= t || q <= 0) continue;
    if (firstSale == null || i < firstSale) firstSale = i;
    const w = Math.floor((t - 1 - i) / 7);
    if (w >= 52) continue;
    weeks[w].q += q;
    weeks[w].docs.set(doc, (weeks[w].docs.get(doc) ?? 0) + q);
  }
  const raw = weeks.map((w) => w.q);
  const nz = raw.filter((x) => x > 0).length;
  let trimmed = raw;
  let trimmedWeeks = 0;
  if (nz >= 13) {
    const med = quantile(raw, 0.5);
    const mad = quantile(raw.map((x) => Math.abs(x - med)), 0.5);
    const cap = med + 3 * 1.4826 * mad;
    trimmed = weeks.map((w, k) => {
      const maxDoc = Math.max(0, ...w.docs.values());
      if (w.q > cap && cap > 0 && maxDoc > 0.6 * w.q) { trimmedWeeks++; return cap; }
      return raw[k];
    });
  }
  const mw = mean(trimmed), sw = std(trimmed);
  return { d: mw / 7, sd: sw / Math.sqrt(7), cv: mw > 0 ? sw / mw : Infinity, nz, trimmedWeeks,
    isNew: firstSale == null || t - firstSale < 91 };
}

function xyzOf(st) { if (st.nz < 13 || st.cv > 1.0) return "Z"; return st.cv < 0.5 ? "X" : "Y"; }

function abcByMargin(margin) {
  const rows = margin.filter((m) => m.zysk > 0).sort((a, b) => b.zysk - a.zysk);
  const tot = rows.reduce((x, m) => x + m.zysk, 0);
  const out = new Map(); let cum = 0;
  for (const m of rows) { cum += m.zysk; const share = cum / tot; out.set(m.id, share - m.zysk / tot < 0.8 ? "A" : share - m.zysk / tot < 0.95 ? "B" : "C"); }
  return out; // missing → C
}

function simulate(ds, policy, opts) {
  const sup = ds.supplier;
  const R = opts.R ?? (sup.interval_weeks || 1) * 7;
  const leadCal = (sup.lead_bd || []).map((b) => Math.max(1, Math.ceil((b * 7) / 5)));
  const L50 = leadCal.length >= 5 ? quantile(leadCal, 0.5) : 7;
  const L90 = leadCal.length >= 5 ? quantile(leadCal, 0.9) : 7;
  const sL = leadCal.length >= 5 ? std(leadCal) : 0.5 * L50;
  const rand = rng(sup.kh * 7919);
  const draws = Array.from({ length: 64 }, () => (leadCal.length ? leadCal[Math.floor(rand() * leadCal.length)] : 7));
  const abc = abcByMargin(ds.margin);
  const start = ds.stock[Object.keys(ds.stock).sort()[0]] ?? {};
  const res = { demand: 0, served: 0, demandV: 0, servedV: 0, oosDays: 0, skuDays: 0, stockV: 0, orders: 0, lines: 0, orderV: [], byClass: {}, trimmedSkus: 0 };
  const cls = (c) => (res.byClass[c] ??= { demand: 0, served: 0, oosDays: 0, skuDays: 0, stockV: 0, skus: 0 });

  for (const p of ds.products) {
    const lines = (ds.sales[p.id] ?? []).map(([k, q, doc]) => [toIdx(k), q, doc]);
    const cost = p.cost;
    if (!cost) continue;
    let stock = Math.max(0, start[p.id]?.[0] ?? 0);
    const daily = new Array(SIM_DAYS).fill(0);
    for (const [i, q] of lines) if (i >= 0 && i < SIM_DAYS && q > 0) daily[i] += q;
    const pipe = new Map();
    const stats0 = demandStats(lines, 0);
    const klass = (abc.get(p.id) ?? "C") + xyzOf(stats0);
    const c = cls(stats0.isNew ? "N" : klass); c.skus++;
    let review = 0, trimmedAny = false;
    for (let t = 0; t < SIM_DAYS; t++) {
      stock += pipe.get(t) ?? 0;
      // snapshot like remanent (end of previous day), weekly from day 0
      if (t % 7 === 0 && p.active) { res.snapN = (res.snapN ?? 0) + 1; if (stock <= 0) res.snapOos = (res.snapOos ?? 0) + 1; }
      if (t % R === 0) {
        const onOrder = [...pipe].filter(([d]) => d > t).reduce((x, [, q]) => x + q, 0);
        let target;
        if (policy === "P2") {
          // max30_90 (automat Polkard): tempo = max(30 d, 90 d), cel = tempo × max(target, cykl + L + 25% L)
          const sumWin = (n) => lines.filter(([i, q]) => i < t && i >= t - n && q > 0).reduce((x, [, q]) => x + q, 0);
          const rate = Math.max(sumWin(30) / 30, sumWin(90) / 90);
          const abcK = abc.get(p.id) ?? "C";
          const base = opts.classDays ? opts.classDays[abcK] : (opts.targetDays ?? 25);
          target = rate * Math.max(base, R + L90 + Math.round(L90 * 0.25));
        } else if (policy === "P0") {
          const s30 = lines.filter(([i, q]) => i < t && i >= t - 30 && q > 0).reduce((x, [, q]) => x + q, 0);
          const dni = opts.dni ?? 30;
          target = (s30 / 30) * dni;
        } else {
          const st = demandStats(lines, t);
          if (st.trimmedWeeks) trimmedAny = true;
          const seg = (abc.get(p.id) ?? "C") + xyzOf(st);
          const z = Math.max(0, Z[seg] + (opts.zShift ?? 0));
          const T = R + L50;
          const ss = z * Math.sqrt(T * st.sd ** 2 + st.d ** 2 * sL ** 2);
          target = Math.min(st.d * T + ss, st.d * (R + L50 + 30));
          var eoqCap = seg[0] === "C" ? Math.max(1, Math.sqrt((2 * st.d * 365 * EOQ_K) / (EOQ_I * cost))) : Infinity;
        }
        let qty = Math.ceil(Math.max(0, target - stock - onOrder) - 1e-9);
        if (policy === "P1" && Number.isFinite(eoqCap)) qty = Math.min(qty, Math.ceil(eoqCap));
        if (qty > 0) {
          const arr = t + draws[review % draws.length];
          pipe.set(arr, (pipe.get(arr) ?? 0) + qty);
          res.lines++;
          (res._ordV ??= new Map()).set(t, ((res._ordV.get(t)) ?? 0) + qty * cost);
        }
        review++;
      }
      const d = daily[t];
      const served = Math.min(stock, d);
      stock -= served;
      const h = t < SIM_DAYS / 2 ? "h1" : "h2"; res[h + "D"] = (res[h + "D"] ?? 0) + d * cost; res[h + "S"] = (res[h + "S"] ?? 0) + served * cost; res[h + "V"] = (res[h + "V"] ?? 0) + stock * cost;
      res.demand += d; res.served += served; res.demandV += d * cost; res.servedV += served * cost;
      c.demand += d * cost; c.served += served * cost;
      if (p.active) { res.skuDays++; c.skuDays++; if (stock <= 0 || d > served) { res.oosDays++; c.oosDays++; } }
      res.stockV += stock * cost; c.stockV += stock * cost;
    }
    if (trimmedAny) res.trimmedSkus++;
  }
  res.orderV = [...(res._ordV ?? new Map()).values()];
  res.orders = res.orderV.length;
  delete res._ordV;
  res.L50 = L50; res.L90 = L90; res.sL = sL; res.R = R;
  return res;
}

/** what really happened: weekly snapshots of real stock (OOS among active SKUs, stock value) */
function reality(ds) {
  const days = Object.keys(ds.stock).sort();
  let oos = 0, n = 0, v = 0;
  for (const p of ds.products) {
    if (!p.cost) continue;
    const active = p.active;
    for (const k of days) {
      const q = ds.stock[k][p.id]?.[0] ?? 0;
      v += q * p.cost / days.length;
      if (active) { n++; if (q <= 0) oos++; }
    }
  }
  return { oosShare: n ? oos / n : 0, avgStockV: v, oos, n };
}

function load(file) {
  const ds = JSON.parse(fs.readFileSync(file, "utf8"));
  const costFromStock = new Map();
  for (const k of Object.keys(ds.stock).sort()) for (const [id, [, c]] of Object.entries(ds.stock[k])) if (c > 0 && !costFromStock.has(+id)) costFromStock.set(+id, c);
  const costFromMargin = new Map(ds.margin.filter((m) => m.qty > 0 && m.koszt > 0).map((m) => [m.id, m.koszt / m.qty]));
  for (const p of ds.products) p.active = (ds.sales[p.id] ?? []).some(([k, q]) => q > 0 && k >= "2025-10-23" && k < SIM_START);
  for (const p of ds.products) p.cost = costFromStock.get(p.id) ?? costFromMargin.get(p.id) ?? null;
  return ds;
}

const VARIANTS = [["P0", "P0", {}], ["P0_45", "P0", { dni: 45 }], ["P0_60", "P0", { dni: 60 }], ["P1", "P1", {}], ["P2_R3", "P2", { R: 3 }], ["P2_R7", "P2", { R: 7 }], ["P2_Rint", "P2", {}], ["P3_R3", "P2", { R: 3, classDays: { A: 30, B: 25, C: 15 } }], ["P3_R7", "P2", { R: 7, classDays: { A: 30, B: 25, C: 15 } }]];
const VN = VARIANTS.map((v) => v[0]);
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const files = fs.readdirSync(DIR).filter((f) => /^\d+\.json$/.test(f));
  const out = [];
  for (const f of files) {
    const ds = load(path.join(DIR, f));
    const row = { name: ds.supplier.name, skus: ds.products.length, noCost: ds.products.filter((p) => !p.cost).length, real: reality(ds) };
    for (const [name, pol, o] of VARIANTS) row[name] = simulate(ds, pol, o);
    out.push(row);
  }
  fs.writeFileSync(path.join(DIR, "..", "result.json"), JSON.stringify(out, null, 1));
  const pct = (x) => (100 * x).toFixed(1) + "%";
  const k = (x) => Math.round(x / 1000) + "k";
  console.log("dostawca | SKU | R/L50/L90 | fill% " + VN.join(" ") + " | OOS% (to samo) | zapas śr. zł (to samo) | real OOS% zapas");
  const tot = {};
  for (const r of out) {
    const f = (p) => pct(r[p].servedV / (r[p].demandV || 1));
    const o = (p) => pct(r[p].oosDays / (r[p].skuDays || 1));
    const s = (p) => k(r[p].stockV / SIM_DAYS);
    console.log([r.name, r.skus, `${r.P1.R}/${r.P1.L50}/${r.P1.L90}`, VN.map(f).join(" "), VN.map(o).join(" "), VN.map(s).join(" "), pct(r.real.oosShare) + " " + k(r.real.avgStockV)].join(" | "));
    for (const p of VN) { const t = (tot[p] ??= { servedV: 0, demandV: 0, oos: 0, sd: 0, stockV: 0, orders: 0, byClass: {} }); t.servedV += r[p].servedV; t.demandV += r[p].demandV; t.oos += r[p].oosDays; t.sd += r[p].skuDays; t.stockV += r[p].stockV / SIM_DAYS; t.orders += r[p].orders;
      for (const [c, v] of Object.entries(r[p].byClass)) { const b = (t.byClass[c] ??= { demand: 0, served: 0, oos: 0, sd: 0, stockV: 0, skus: 0 }); b.demand += v.demand; b.served += v.served; b.oos += v.oosDays; b.sd += v.skuDays; b.stockV += v.stockV / SIM_DAYS; b.skus += v.skus; } }
  }
  console.log("\nRAZEM");
  for (const p of Object.keys(tot)) { const h = out.reduce((a, r) => { a[0] += r[p].h1S; a[1] += r[p].h1D; a[2] += r[p].h2S; a[3] += r[p].h2D; a[4] += r[p].h1V; a[5] += r[p].h2V; return a; }, [0, 0, 0, 0, 0, 0]);
    const ov = out.flatMap((r) => r[p].orderV); const med = ov.length ? ov.sort((a, b) => a - b)[Math.floor(ov.length / 2)] : 0;
    console.log(p, "fill H1", pct(h[0] / h[1]), "H2", pct(h[2] / h[3]), "zapas H1", k(h[4] / (SIM_DAYS / 2)), "H2", k(h[5] / (SIM_DAYS / 2)), "mediana ZD zł", Math.round(med)); }
  for (const [p, t] of Object.entries(tot)) console.log(p, "fill", pct(t.servedV / t.demandV), "OOS", pct(t.oos / t.sd), "zapas", k(t.stockV), "ZD", t.orders);
  console.log("\nKLASY (fill wartościowo / OOS dni / zapas śr. / SKU)");
  for (const c of Object.keys(tot.P0.byClass).sort()) console.log(c, VN.map((p) => { const b = tot[p].byClass[c]; return `${p} ${pct(b.served / (b.demand || 1))} ${pct(b.oos / (b.sd || 1))} ${k(b.stockV)}`; }).join(" | "), "SKU", tot.P0.byClass[c].skus);
  const realT = out.reduce((x, r) => x + r.real.avgStockV, 0);
  console.log("\nRZECZYWISTOŚĆ zapas śr.", k(realT));
  const pick = ["P0", "P0_45", "P0_60", "P2_R3", "P2_R7"];
  console.log("\nTYGODNIOWE ZDJĘCIE (jak remanent): % aktywnych SKU z zerowym stanem | śr. zapas");
  console.log("dostawca | real | " + pick.join(" | "));
  for (const r of out) console.log(r.name, "|", pct(r.real.oosShare), k(r.real.avgStockV), "|", pick.map((p) => pct((r[p].snapOos ?? 0) / r[p].snapN) + " " + k(r[p].stockV / SIM_DAYS)).join(" | "));
  const ro = out.reduce((a, r) => [a[0] + r.real.oos, a[1] + r.real.n], [0, 0]);
  console.log("RAZEM | " + pct(ro[0] / ro[1]) + " " + k(realT) + " | " + pick.map((p) => { const s = out.reduce((a, r) => [a[0] + (r[p].snapOos ?? 0), a[1] + r[p].snapN, a[2] + r[p].stockV / SIM_DAYS], [0, 0, 0]); return pct(s[0] / s[1]) + " " + k(s[2]); }).join(" | "));
  const winsReal = (p) => out.filter((r) => (r[p].snapOos ?? 0) / r[p].snapN <= r.real.oosShare && r[p].stockV / SIM_DAYS <= r.real.avgStockV).length;
  for (const p of pick) console.log(p, "nie gorszy od rzeczywistości w brakach I zapasie u", winsReal(p), "/", out.length);
  const wins = (a, b) => out.filter((r) => r[a].oosDays / r[a].skuDays < r[b].oosDays / r[b].skuDays && r[a].stockV <= r[b].stockV * 1.1).length;
  for (const p of VN) if (p !== "P0") console.log(p, "lepszy od P0 (mniej braków i zapas ≤ +10%) u", wins(p, "P0"), "/", out.length);
}
