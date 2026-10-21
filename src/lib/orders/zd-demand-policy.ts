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
