/**
 * Strategia zamawiania per dostawca (test na Polkardzie, backtest 10.2026).
 *
 * „classic” = jak dotąd: tempo z okna Kreatora × dni zapasu dostawcy.
 * „max30_90” = tempo nie niższe niż średnia z 90 dni (ostatnie 3 okna profilu 12 × 30 d),
 * cel na `targetDays` dni, zamawianie co `cycleDays` dni. Podłoga 90 d trzyma towar,
 * który chwilowo mniej sprzedał; krótszy cel przy częstszych ZD ogranicza zapas
 * po jednorazowej dużej sprzedaży (zamówi ok. targetDays/30 jej ilości, nie całość).
 * Czysta logika — ta sama funkcja liczy Kreator, nocny przebieg i backtest.
 */

export type ZdDemandStrategy = "classic" | "max30_90";

export type ZdSupplierOrderPolicy = {
  strategy: ZdDemandStrategy;
  /** Dni zapasu w celu; null = dni zapasu dostawcy (jak dotąd). */
  targetDays: number | null;
  /** Co ile dni propozycja ZD; null = bez propozycji automatu. */
  cycleDays: number | null;
};

export const ZD_SUPPLIER_ORDER_POLICY_CLASSIC: ZdSupplierOrderPolicy = {
  strategy: "classic",
  targetDays: null,
  cycleDays: null,
};

/** Okna profilu do średniej (3 × 30 d = 90 d). */
export const ZD_DEMAND_FLOOR_WINDOWS = 3;

export function effectiveDniZapasu(policy: ZdSupplierOrderPolicy, supplierDniZapasu: number): number {
  const t = Number(policy.targetDays);
  return Number.isFinite(t) && t >= 1 ? Math.round(t) : supplierDniZapasu;
}

/** Sprzedaż z ostatnich 90 dni z profilu (12 okien po 30 d, od najstarszego). */
export function sales90FromProfile(windows: readonly number[] | null | undefined): number | null {
  if (!windows || windows.length < ZD_DEMAND_FLOOR_WINDOWS) return null;
  return windows.slice(-ZD_DEMAND_FLOOR_WINDOWS).reduce((a, x) => a + Math.max(0, Number(x) || 0), 0);
}

/**
 * Podłoga tempa z 90 dni: gdy średnia 90 d jest wyższa niż tempo z okna, podnosi sprzedaż
 * w oknie i cel do tej średniej (cel z API = tempo × dni zapasu + zapasMin, więc różnica
 * tempa × dni zapasu). Nigdy nie obniża. Classic albo brak profilu → linia bez zmian.
 */
export function applyZdDemandFloorToLine<
  T extends {
    sprzedazOkres?: number | null;
    sprzedazDziennie?: number | null;
    celZapasu?: number | null;
  },
>(
  line: T,
  input: { policy: ZdSupplierOrderPolicy; sales90: number | null; dniOkresu: number; dniZapasu: number }
): T & { demandFloor?: { sales90: number; rateBefore: number; rateAfter: number } } {
  if (input.policy.strategy !== "max30_90" || input.sales90 == null) return line;
  const days = Math.max(1, input.dniOkresu);
  const rateBefore = Math.max(0, Number(line.sprzedazOkres) || 0) / days;
  const rateAfter = input.sales90 / 90;
  if (!(rateAfter > rateBefore + 1e-9)) return line;
  const celRaw = Math.max(0, Number(line.celZapasu) || 0);
  return {
    ...line,
    sprzedazOkres: rateAfter * days,
    sprzedazDziennie: rateAfter,
    // Zaokrąglenie do 1e-6 — szum zmiennoprzecinkowy przesuwa progi podążania za sprzedażą.
    celZapasu: Math.round((celRaw + (rateAfter - rateBefore) * Math.max(1, input.dniZapasu)) * 1e6) / 1e6,
    demandFloor: { sales90: input.sales90, rateBefore, rateAfter },
  };
}

/** Strategia testowa: lista „Do ZD” policzona „jak dotąd” na tym samym zakresie (porównanie w Kreatorze). */
export type ZdClassicCompare = {
  byTwId: Record<number, { units: number; pieces: number }>;
  lineCount: number;
  pieces: number;
};

type SalesLine = { sprzedazOkres?: number | null; sprzedazDziennie?: number | null };

/**
 * Podłoga 90 d dla PARY: popyt pary to sztuki + paczki × przelicznik, więc podłoga liczy się raz
 * dla pary (nie max(paczki) + max(sztuki), co zawyżałoby cel). Gdy średnia 90 d pary jest wyższa,
 * obie strony dostają ten sam współczynnik; bez sprzedaży w oknie tempo idzie na stronę sztuk.
 * Zwraca null, gdy podłoga nic nie zmienia. `floor` — w sztukach pary (krok „Dlaczego tyle”).
 */
export function applyZdPairDemandFloor<P extends SalesLine, Q extends SalesLine>(input: {
  policy: ZdSupplierOrderPolicy;
  pack: P;
  piece: Q | null;
  unitsPerPack: number;
  /** Sprzedaż pary w sztukach z ostatnich 90 dni (profil łączny). */
  sales90: number | null;
  dniOkresu: number;
}): { pack: P; piece: Q | null; floor: { sales90: number; rateBefore: number; rateAfter: number } } | null {
  if (input.policy.strategy !== "max30_90" || input.sales90 == null) return null;
  const ratio = Math.max(1, Number(input.unitsPerPack) || 1);
  const days = Math.max(1, input.dniOkresu);
  const packSales = Math.max(0, Number(input.pack.sprzedazOkres) || 0);
  const pieceSales = input.piece ? Math.max(0, Number(input.piece.sprzedazOkres) || 0) : 0;
  const rawSales = packSales * ratio + pieceSales;
  const rateBefore = rawSales / days;
  const rateAfter = input.sales90 / 90;
  if (!(rateAfter > rateBefore + 1e-9)) return null;
  const floor = { sales90: input.sales90, rateBefore, rateAfter };
  if (rawSales > 0) {
    const f = rateAfter / rateBefore;
    const scale = <T extends SalesLine>(l: T): T => ({
      ...l,
      sprzedazOkres: Math.max(0, Number(l.sprzedazOkres) || 0) * f,
      sprzedazDziennie: (Math.max(0, Number(l.sprzedazOkres) || 0) * f) / days,
    });
    return { pack: scale(input.pack), piece: input.piece ? scale(input.piece) : null, floor };
  }
  if (input.piece) {
    return {
      pack: input.pack,
      piece: { ...input.piece, sprzedazOkres: rateAfter * days, sprzedazDziennie: rateAfter },
      floor,
    };
  }
  return {
    pack: { ...input.pack, sprzedazOkres: (rateAfter * days) / ratio, sprzedazDziennie: rateAfter / ratio },
    piece: null,
    floor,
  };
}

/**
 * Podłoga 90 d dla składników zestawów „Składamy”: expand dokłada składnikowi sprzedaż
 * zestawu × ilość, więc podłoga per linia dałaby max(składnik) + ilość × max(zestaw).
 * Tu raz, na łącznym popycie (własne + Σ ilość × zestaw); składnik dostaje tylko dopełnienie
 * do podłogi (wkład zestawów doliczy expand). Zestaw w zestawie, składnik w parze i brak
 * profilu którejkolwiek strony — bez łącznej podłogi (składnik wraca do własnej, per linia).
 * Zmienia `lines` w miejscu; zwraca składniki obsłużone tutaj (bez podłogi per linia).
 */
export function applyZdBomDemandFloor<
  T extends {
    tw_Id: number;
    sprzedazOkres?: number | null;
    sprzedazDziennie?: number | null;
    celZapasu?: number | null;
  },
>(input: {
  lines: T[];
  explodeBoms: readonly { parentTwId: number; components: readonly { componentTwId: number; qtyPerParent: number }[] }[];
  profiles: ReadonlyMap<number, readonly number[]>;
  /** Sprzedaż w oknie przed podłogą. */
  rawSalesByTw: ReadonlyMap<number, number>;
  pairTwIds: ReadonlySet<number>;
  policy: ZdSupplierOrderPolicy;
  dniOkresu: number;
  dniZapasu: number;
}): Set<number> {
  const handled = new Set<number>();
  if (input.policy.strategy !== "max30_90") return handled;
  const days = Math.max(1, input.dniOkresu);
  const indexByTw = new Map(input.lines.map((l, i) => [Math.trunc(Number(l.tw_Id) || 0), i]));
  const parentIds = new Set(input.explodeBoms.map((b) => b.parentTwId));
  const termsByComponent = new Map<number, { parentTwId: number; qty: number }[]>();
  for (const bom of input.explodeBoms) {
    if (!indexByTw.has(bom.parentTwId)) continue;
    for (const c of bom.components) {
      const list = termsByComponent.get(c.componentTwId) ?? [];
      list.push({ parentTwId: bom.parentTwId, qty: Math.max(1, Math.trunc(c.qtyPerParent)) });
      termsByComponent.set(c.componentTwId, list);
    }
  }
  for (const [cid, terms] of termsByComponent) {
    const idx = indexByTw.get(cid);
    if (idx == null || input.pairTwIds.has(cid) || parentIds.has(cid)) continue;
    if (terms.some((t) => termsByComponent.has(t.parentTwId))) continue;
    const own = input.profiles.get(cid);
    const kitWindows = terms.map((t) => input.profiles.get(t.parentTwId));
    if (!own || kitWindows.some((w) => !w)) continue;
    handled.add(cid);
    const combined = own.map(
      (v, k) => Math.max(0, v) + terms.reduce((sum, t, i) => sum + t.qty * Math.max(0, kitWindows[i]![k] ?? 0), 0)
    );
    const kitRaw = terms.reduce((sum, t) => sum + t.qty * Math.max(0, input.rawSalesByTw.get(t.parentTwId) ?? 0), 0);
    const ownRaw = Math.max(0, input.rawSalesByTw.get(cid) ?? 0);
    const line = input.lines[idx]!;
    const floored = applyZdDemandFloorToLine(
      { sprzedazOkres: ownRaw + kitRaw, sprzedazDziennie: (ownRaw + kitRaw) / days, celZapasu: line.celZapasu },
      { policy: input.policy, sales90: sales90FromProfile(combined), dniOkresu: days, dniZapasu: input.dniZapasu }
    );
    if (!floored.demandFloor) continue;
    const ownAfter = Math.max(ownRaw, (Number(floored.sprzedazOkres) || 0) - kitRaw);
    input.lines[idx] = {
      ...line,
      sprzedazOkres: ownAfter,
      sprzedazDziennie: ownAfter / days,
      celZapasu: floored.celZapasu,
      demandFloor: floored.demandFloor,
    };
  }
  return handled;
}
