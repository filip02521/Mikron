/**
 * Szacunek listy do zamówienia ZD — tryb „jak ręcznie”.
 *
 * Proces ręczny (zakupy):
 * 1. Wybór grupy towarowej w Subiekcie (np. Falcon, Ivoclar).
 * 2. Dla każdego produktu: sprzedaż w okresie ≈ zapas dostawcy (OnTime).
 * 3. Porównanie ze stanem dostępnym.
 * 4. Odjęcie ilości już na otwartych ZD.
 *
 * Formuła qty (bez otwartych ZK — ZK tylko informacyjnie):
 *   doZamowieniaReczne = max(0, ceil(celZapasu − dostepne − otwarteZd))
 *
 * celZapasu liczy API: (sprzedazOkres / dniOkresu) × dniZapasu + zapasMin
 * Gdy dniOkresu ≈ dniZapasu, cel ≈ sprzedaż w oknie zapasu.
 */

import type { OrderInterval } from "@/lib/orders/dates";
import { resolveSupplierInterval } from "@/lib/orders/dates";
import type {
  SubiektZdEstimateLine,
  SubiektZdEstimateParams,
} from "@/lib/subiekt/types";

/** Domyślny zapas w dniach, gdy brak ustawienia dostawcy. */
export const DEFAULT_DNI_ZAPASU = 30;

/** Bezpieczny limit stron przy dociąganiu całej grupy z API. */
export const ZD_ESTIMATE_MAX_PAGES = 40;

/** pageSize przy dociąganiu (max API = 200). */
export const ZD_ESTIMATE_PAGE_SIZE = 200;

export type ManualZdEstimateLine = {
  tw_Id: number;
  tw_Symbol: string;
  tw_Nazwa: string;
  tw_IdGrupa: number | null;
  grt_Nazwa: string;
  tw_Stan: number;
  tw_StanRez: number;
  dostepne: number;
  sprzedazOkres: number;
  sprzedazDziennie: number;
  celZapasu: number;
  otwarteZkBezRez: number;
  otwarteZkZarezerwowane: number;
  otwarteZd: number;
  /** Surowy wynik API (z ZK) — nie używany jako qty zamówienia. */
  doZamowieniaApi: number;
  /**
   * Ilość do wrzucenia na listę — jak ręcznie:
   * max(0, ceil(celZapasu − dostepne − otwarteZd)).
   */
  doZamowieniaReczne: number;
  /** Różnica API − ręcznie (= wkład otwartych ZK bez rez. przy typowych danych). */
  wkladZk: number;
};

export type ManualZdEstimateResult = {
  parametry: SubiektZdEstimateParams;
  pozycje: ManualZdEstimateLine[];
  /** Wszystkie pozycje z odpowiedzi Subiekta (po ewentualnym filtrze UI). */
  totalFromSubiekt: number;
  /** Pozycje z doZamowieniaReczne > 0. */
  doZamowieniaCount: number;
  /** Suma doZamowieniaReczne. */
  doZamowieniaSuma: number;
};

function asFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asOptionalInt(value: unknown): number | null {
  const n = asFiniteNumber(value, NaN);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/**
 * Zapas dostawcy (stock_raw / stock) → dni na parametr `dniZapasu`.
 * Tygodnie × 7, miesiące × 30 (jak „zapas na miesiąc” w praktyce zakupów).
 * „W razie potrzeby” / brak → null (UI wymaga ręcznego dniZapasu).
 */
export function stockPeriodToDniZapasu(
  stockRaw: string | null | undefined,
  stockWeeks: number | null | undefined
): number | null {
  const raw = stockRaw?.trim() ?? "";
  if (/w razie potrzeby/i.test(raw)) return null;

  const interval: OrderInterval | null = resolveSupplierInterval(
    stockRaw,
    stockWeeks
  );
  if (!interval) return null;
  if (interval.unit === "weeks") {
    const days = interval.value * 7;
    return days > 0 ? days : null;
  }
  const days = interval.value * 30;
  return days > 0 ? days : null;
}

/**
 * Ilość do zamówienia jak w procesie ręcznym (bez ZK).
 * Zaokrąglenie w górę — nie zamawiamy ułamków z API.
 * `dostepne` / `otwarteZd` clamp ≥ 0 (ujemny stan z API nie zawyża qty).
 */
export function computeManualOrderQty(input: {
  celZapasu: number;
  dostepne: number;
  otwarteZd: number;
}): number {
  const cel = asFiniteNumber(input.celZapasu);
  const dostepne = Math.max(0, asFiniteNumber(input.dostepne));
  const otwarteZd = Math.max(0, asFiniteNumber(input.otwarteZd));
  const raw = cel - dostepne - otwarteZd;
  if (!(raw > 0)) return 0;
  return Math.ceil(raw - Number.EPSILON);
}

export function mapZdEstimateLineToManual(
  line: SubiektZdEstimateLine
): ManualZdEstimateLine {
  const tw_Stan = asFiniteNumber(line.tw_Stan);
  const tw_StanRez = asFiniteNumber(line.tw_StanRez);
  const dostepne =
    line.dostepne == null
      ? tw_Stan - tw_StanRez
      : asFiniteNumber(line.dostepne);

  const celZapasu = asFiniteNumber(line.celZapasu);
  const otwarteZd = asFiniteNumber(line.otwarteZd);
  const otwarteZkBezRez = asFiniteNumber(line.otwarteZkBezRez);
  const doZamowieniaApi = asFiniteNumber(line.doZamowienia);
  const doZamowieniaReczne = computeManualOrderQty({
    celZapasu,
    dostepne,
    otwarteZd,
  });

  return {
    tw_Id: asFiniteNumber(line.tw_Id),
    tw_Symbol: String(line.tw_Symbol ?? "").trim() || "—",
    tw_Nazwa: String(line.tw_Nazwa ?? "").trim() || "—",
    tw_IdGrupa: asOptionalInt(line.tw_IdGrupa),
    grt_Nazwa: String(line.grt_Nazwa ?? "").trim() || "—",
    tw_Stan,
    tw_StanRez,
    dostepne,
    sprzedazOkres: asFiniteNumber(line.sprzedazOkres),
    sprzedazDziennie: asFiniteNumber(line.sprzedazDziennie),
    celZapasu,
    otwarteZkBezRez,
    otwarteZkZarezerwowane: asFiniteNumber(line.otwarteZkZarezerwowane),
    otwarteZd,
    doZamowieniaApi,
    doZamowieniaReczne,
    wkladZk: Math.max(0, doZamowieniaApi - doZamowieniaReczne),
  };
}

export function buildManualZdEstimateResult(
  parametry: SubiektZdEstimateParams,
  lines: SubiektZdEstimateLine[],
  options?: { onlyManualBraki?: boolean }
): ManualZdEstimateResult {
  const onlyManualBraki = options?.onlyManualBraki === true;
  const mapped = lines.map(mapZdEstimateLineToManual);
  const orderSummary = summarizeManualOrderQty(mapped);

  const pozycje = onlyManualBraki
    ? mapped.filter((p) => p.doZamowieniaReczne > 0)
    : mapped;

  pozycje.sort((a, b) => {
    if (b.doZamowieniaReczne !== a.doZamowieniaReczne) {
      return b.doZamowieniaReczne - a.doZamowieniaReczne;
    }
    return a.tw_Symbol.localeCompare(b.tw_Symbol, "pl");
  });

  return {
    parametry,
    pozycje,
    totalFromSubiekt: mapped.length,
    doZamowieniaCount: orderSummary.doZamowieniaCount,
    doZamowieniaSuma: orderSummary.doZamowieniaSuma,
  };
}

/**
 * Sumuje qty do zamówienia, pomijając trwale wykluczone tw_Id.
 * Używane w UI po każdej zmianie listy wykluczeń (bez ponownego API).
 */
export function summarizeManualOrderQty(
  lines: ManualZdEstimateLine[],
  excludedTwIds?: ReadonlySet<number> | readonly number[] | null
): { doZamowieniaCount: number; doZamowieniaSuma: number } {
  const excluded =
    excludedTwIds instanceof Set
      ? excludedTwIds
      : new Set(excludedTwIds ?? []);
  let doZamowieniaCount = 0;
  let doZamowieniaSuma = 0;
  for (const p of lines) {
    if (excluded.has(p.tw_Id)) continue;
    if (p.doZamowieniaReczne <= 0) continue;
    doZamowieniaCount += 1;
    doZamowieniaSuma += p.doZamowieniaReczne;
  }
  return { doZamowieniaCount, doZamowieniaSuma };
}

/** Pozycje do zamówienia / TSV — qty > 0 i poza listą wykluczeń. */
export function filterOrderableManualLines(
  lines: ManualZdEstimateLine[],
  excludedTwIds?: ReadonlySet<number> | readonly number[] | null
): ManualZdEstimateLine[] {
  const excluded =
    excludedTwIds instanceof Set
      ? excludedTwIds
      : new Set(excludedTwIds ?? []);
  return lines.filter(
    (l) => l.doZamowieniaReczne > 0 && !excluded.has(l.tw_Id)
  );
}

export type ManualLinePackagingLookup = {
  unitsPerPackage: number;
  packageLabel?: string;
} | null;

/**
 * TSV do wklejenia — kolumna do_zd = co wpisać w Subiekcie
 * (jednostki opakowania, gdy ustawione).
 */
export function manualLinesToTsv(
  lines: ManualZdEstimateLine[],
  packagingByTwId?: ReadonlyMap<number, ManualLinePackagingLookup> | null
): string {
  const header = [
    "symbol",
    "nazwa",
    "do_zd",
    "szt_opakowania",
    "szt_przyjdzie",
    "szt_potrzeba",
    "stan",
    "rezerwacje",
    "dostepne",
    "sprzedaz_okres",
    "cel_zapasu",
    "otwarte_zd",
    "otwarte_zk_bez_rez",
    "tw_Id",
  ].join("\t");

  // Lazy import avoided — resolve in caller or duplicate thin logic here.
  // Callers should prefer packaging-aware export from zd-estimate-packaging.
  const rows = lines.map((l) => {
    const pack = packagingByTwId?.get(l.tw_Id) ?? null;
    const units = pack?.unitsPerPackage && pack.unitsPerPackage > 1
      ? Math.trunc(pack.unitsPerPackage)
      : 1;
    const pieces = l.doZamowieniaReczne;
    const zd =
      units > 1 && pieces > 0 ? Math.ceil(pieces / units) : pieces;
    const arriving = units > 1 ? zd * units : pieces;
    return [
      l.tw_Symbol,
      l.tw_Nazwa,
      zd,
      units > 1 ? units : "",
      arriving,
      pieces,
      formatQty(l.tw_Stan),
      formatQty(l.tw_StanRez),
      formatQty(l.dostepne),
      formatQty(l.sprzedazOkres),
      formatQty(l.celZapasu),
      formatQty(l.otwarteZd),
      formatQty(l.otwarteZkBezRez),
      l.tw_Id,
    ].join("\t");
  });
  return [header, ...rows].join("\n");
}

/** yyyy-mm-dd → yyyy-mm-dd minus N dni kalendarzowych (okno sprzedaży). */
export function salesWindowFromDniZapasu(
  dniZapasu: number,
  endDateKey: string
): { dataOd: string; dataDo: string } {
  const days = Math.max(1, Math.round(dniZapasu));
  const end = parseDateKey(endDateKey);
  const start = new Date(end);
  // Inclusive window of `days` days ending on endDateKey:
  // e.g. days=30, end=2026-08-06 → start=2026-07-08 (30 days: 08..06).
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    dataOd: formatDateKey(start),
    dataDo: formatDateKey(end),
  };
}

function parseDateKey(key: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!m) throw new Error(`Niepoprawna data: ${key}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function formatDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString("pl-PL", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}
