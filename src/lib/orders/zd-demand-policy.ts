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
    celZapasu: celRaw + (rateAfter - rateBefore) * Math.max(1, input.dniZapasu),
    demandFloor: { sales90: input.sales90, rateBefore, rateAfter },
  };
}
