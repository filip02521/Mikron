/**
 * Profil sprzedaży 12 × 30 dni — czysta logika (bez I/O).
 *
 * Bazowy cel z Subiekta = sprzedaż w oknie ÷ dni okna × dni zapasu, więc każda
 * sprzedaż w oknie trafia w cel. Profil pozwala odróżnić:
 *   - spike  — bieżące okno ≥ 3× typowego miesiąca (jednorazowa duża sprzedaż),
 *   - rare   — sprzedaż w ≤ 3 z 12 okien (kupowany pod zamówienie?),
 *   - new    — sprzedaż dopiero w ostatnich 3 oknach (nowość — nie ruszamy),
 *   - rising — poprzednie okno też wysokie (wzrost — nie ruszamy),
 *   - steady — reszta.
 *
 * Wygładzenie (opcja w Kreatorze, domyślnie wyłączona) tylko OBNIŻA sprzedaż
 * w oknie: spike → typowy miesiąc (max z mediany i p75), rare → średnia z 12 okien.
 * Sprzedaż pod zrealizowane prośby odejmujemy przed klasyfikacją — prośba jest
 * zamawiana osobno, więc nie powinna drugi raz budować zapasu.
 */

import { polishPluralWord } from "@/lib/email/polish-plural";

export const ZD_SALES_PROFILE = {
  windows: 12,
  windowDays: 30,
  /** Bieżące okno (w przeliczeniu na 30 dni) ≥ tyle × typowy miesiąc → skok. */
  spikeRatio: 3,
  /** Skok tylko od tylu sztuk w bieżącym oknie (na 30 dni). */
  spikeMinPieces: 5,
  /** Okno przed bieżącym ≥ tyle × typowy → wzrost, nie skok. */
  risingRatio: 1.5,
  /** Sprzedaż w najwyżej tylu oknach z 12 → rzadki. */
  rareMaxActiveWindows: 3,
  /** Pierwsza sprzedaż w ostatnich tylu oknach → nowość. */
  newWithinWindows: 3,
} as const;

export type ZdSalesProfileKind = "steady" | "rare" | "spike" | "new" | "rising" | "none";

/** Dołączane do wiersza API i dalej do wiersza Kreatora (przeżywa przeliczenia w przeglądarce). */
export type ZdSalesProfileLineMeta = {
  kind: ZdSalesProfileKind;
  /** Okna 30-dniowe, od najstarszego (sztuki karty). */
  windows: number[];
  activeWindows: number;
  /** Mediana okien sprzed bieżącego okna Kreatora. */
  typicalMonthly: number;
  /** Bieżące okno Kreatora w przeliczeniu na 30 dni (po odjęciu próśb). */
  currentMonthly: number;
  /** Sprzedaż w oknie z Subiekta, przed wygładzeniem. */
  rawSprzedazOkres: number;
  /** Sztuki z zrealizowanych próśb w oknie (odjęte, gdy wygładzenie włączone). */
  prosbaPieces: number;
  /** Opcja wygładzenia była włączona przy tym Policz (profil zastępuje stary „skok”). */
  smoothing: boolean;
  /** Wygładzenie faktycznie zmieniło sprzedaż w oknie. */
  applied: boolean;
  /** Sprzedaż w oknie po wygładzeniu ÷ przed (1 = bez zmian). */
  factor: number;
};

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1));
  return s[idx]!;
}

export function classifyZdSalesProfile(input: {
  windows: readonly number[];
  /** Sprzedaż w oknie Kreatora (po odjęciu próśb, jeśli dotyczy). */
  currentSales: number;
  currentDays: number;
}): {
  kind: ZdSalesProfileKind;
  activeWindows: number;
  typicalMonthly: number;
  robustMonthly: number;
  meanMonthly: number;
  currentMonthly: number;
} {
  const p = ZD_SALES_PROFILE;
  const w = input.windows.map((x) => Math.max(0, Number(x) || 0));
  const days = Math.max(1, input.currentDays);
  const currentMonthly = (Math.max(0, input.currentSales) / days) * p.windowDays;
  // Okna nakładające się na bieżące okno Kreatora nie są „historią”.
  const overlap = Math.min(w.length - 1, Math.max(1, Math.ceil(days / p.windowDays)));
  const prev = w.slice(0, w.length - overlap);
  const typicalMonthly = median(prev);
  const robustMonthly = Math.max(typicalMonthly, percentile(prev, 0.75));
  const meanMonthly = w.length ? w.reduce((a, b) => a + b, 0) / w.length : 0;
  const activeWindows = w.filter((x) => x > 0).length;
  const base = { activeWindows, typicalMonthly, robustMonthly, meanMonthly, currentMonthly };

  if (activeWindows === 0 && currentMonthly <= 0) return { kind: "none", ...base };
  // Nowość = sprzedaż powtarza się w ostatnich oknach. Jedna sprzedaż po roku ciszy
  // to raczej zakup pod klienta (rzadki), nie nowy towar.
  const firstActive = w.findIndex((x) => x > 0);
  if (firstActive >= w.length - p.newWithinWindows && activeWindows >= 2) {
    return { kind: "new", ...base };
  }
  if (activeWindows <= p.rareMaxActiveWindows) return { kind: "rare", ...base };

  const floor = Math.max(1, typicalMonthly);
  const before = prev[prev.length - 1] ?? 0;
  if (currentMonthly >= p.spikeMinPieces && currentMonthly >= p.spikeRatio * floor) {
    return { kind: before >= p.risingRatio * floor ? "rising" : "spike", ...base };
  }
  return { kind: "steady", ...base };
}

/**
 * Sprzedaż w oknie po wygładzeniu (sztuki karty). Nigdy nie podnosi.
 * `smoothing=false` → tylko klasyfikacja (znaczniki), sprzedaż bez zmian.
 */
export function resolveZdSalesProfile(input: {
  windows: readonly number[];
  sprzedazOkres: number;
  dniOkresu: number;
  prosbaPieces: number;
  smoothing: boolean;
}): ZdSalesProfileLineMeta {
  const raw = Math.max(0, input.sprzedazOkres);
  const prosba = Math.min(raw, Math.max(0, input.prosbaPieces));
  const afterProsba = input.smoothing ? raw - prosba : raw;
  const c = classifyZdSalesProfile({
    windows: input.windows,
    currentSales: afterProsba,
    currentDays: input.dniOkresu,
  });
  let smoothed = afterProsba;
  if (input.smoothing && c.currentMonthly > 0) {
    const target =
      c.kind === "spike" ? c.robustMonthly : c.kind === "rare" ? c.meanMonthly : c.currentMonthly;
    smoothed = afterProsba * Math.min(1, target / c.currentMonthly);
  }
  const factor = raw > 0 ? smoothed / raw : 1;
  return {
    kind: c.kind,
    windows: input.windows.map((x) => Math.max(0, Number(x) || 0)),
    activeWindows: c.activeWindows,
    typicalMonthly: c.typicalMonthly,
    currentMonthly: c.currentMonthly,
    rawSprzedazOkres: raw,
    prosbaPieces: prosba,
    smoothing: input.smoothing,
    applied: factor < 1 - 1e-9,
    factor,
  };
}

/**
 * Wiersz API po wygładzeniu: sprzedaż, tempo i cel skalowane tym samym czynnikiem.
 * celZapasu z API = (sprzedaż / dniOkresu) × dniZapasu + zapasMin → skalujemy część
 * zależną od sprzedaży; doZamowienia przeliczamy wzorem API.
 */
export function applyZdSalesProfileToLine<
  T extends {
    sprzedazOkres?: number | null;
    sprzedazDziennie?: number | null;
    wzNiepowiazaneOkres?: number | null;
    celZapasu?: number | null;
    doZamowienia?: number | null;
    dostepne?: number | null;
    otwarteZd?: number | null;
    otwarteZkBezRez?: number | null;
  },
>(line: T, meta: ZdSalesProfileLineMeta, zapasMin: number): T & { salesProfile: ZdSalesProfileLineMeta } {
  if (!meta.applied) return { ...line, salesProfile: meta };
  const f = meta.factor;
  const sprzedaz = Math.max(0, Number(line.sprzedazOkres) || 0) * f;
  const celRaw = Math.max(0, Number(line.celZapasu) || 0);
  const min = Math.max(0, zapasMin);
  const cel = Math.max(0, celRaw - min) * f + Math.min(min, celRaw);
  const doZamowienia = Math.max(
    0,
    cel +
      Math.max(0, Number(line.otwarteZkBezRez) || 0) -
      (Number(line.dostepne) || 0) -
      Math.max(0, Number(line.otwarteZd) || 0)
  );
  return {
    ...line,
    sprzedazOkres: sprzedaz,
    sprzedazDziennie: Math.max(0, Number(line.sprzedazDziennie) || 0) * f,
    wzNiepowiazaneOkres: Math.min(Math.max(0, Number(line.wzNiepowiazaneOkres) || 0), sprzedaz),
    celZapasu: cel,
    doZamowienia,
    salesProfile: meta,
  };
}

/** Ile pozycji zmieniło wygładzenie w jednym Policz. */
export type ZdSalesSmoothingSummary = {
  spike: number;
  rare: number;
  prosba: number;
  /** Profil niedostępny (błąd Subiekta / bazy) — lista liczona bez wygładzenia. */
  failed: boolean;
};

export function formatZdSalesSmoothingSummary(s: ZdSalesSmoothingSummary): string {
  const parts = [
    s.spike > 0 ? `${s.spike} ${polishPluralWord(s.spike, "jednorazowy skok", "jednorazowe skoki", "jednorazowych skoków")}` : null,
    s.rare > 0 ? `${s.rare} ${polishPluralWord(s.rare, "towar z rzadką sprzedażą", "towary z rzadką sprzedażą", "towarów z rzadką sprzedażą")}` : null,
    s.prosba > 0 ? `${s.prosba} ${polishPluralWord(s.prosba, "towar ze sprzedażą pod prośby", "towary ze sprzedażą pod prośby", "towarów ze sprzedażą pod prośby")}` : null,
  ].filter(Boolean);
  if (parts.length === 0) {
    return s.failed ? "" : "W tym zakresie nie ma nietypowej sprzedaży - ilości bez zmian.";
  }
  return `Liczone z typowego miesiąca zamiast bieżącego okna: ${parts.join(", ")}. Szczegóły w podpowiedzi przy sprzedaży (znacznik pod nazwą).`;
}

/** Okna 30-dniowe kończące się `endDate` (włącznie), od najstarszego. */
export function zdSalesProfileWindows(endDate: string): Array<{ dataOd: string; dataDo: string }> {
  const p = ZD_SALES_PROFILE;
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const day = 24 * 60 * 60 * 1000;
  const key = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const out: Array<{ dataOd: string; dataDo: string }> = [];
  for (let i = p.windows - 1; i >= 0; i -= 1) {
    const to = end - i * p.windowDays * day;
    out.push({ dataOd: key(to - (p.windowDays - 1) * day), dataDo: key(to) });
  }
  return out;
}

function fmt(n: number): string {
  return n.toLocaleString("pl-PL", { maximumFractionDigits: 1 });
}

/** Krótki opis do podpowiedzi (title) i znacznika. */
export function formatZdSalesProfileHint(meta: ZdSalesProfileLineMeta): string {
  const series = meta.windows.map((x) => fmt(x)).join(" · ");
  const head =
    meta.kind === "spike"
      ? `Jednorazowy skok: ${fmt(meta.currentMonthly)} szt / 30 d, zwykle ~${fmt(meta.typicalMonthly)}.`
      : meta.kind === "rare"
        ? `Rzadka sprzedaż: w ${meta.activeWindows} z ${meta.windows.length} miesięcy - może kupowany pod zamówienie.`
        : meta.kind === "new"
          ? "Nowość - sprzedaż dopiero od ostatnich miesięcy."
          : meta.kind === "rising"
            ? `Wzrost sprzedaży: ${fmt(meta.currentMonthly)} szt / 30 d, wcześniej ~${fmt(meta.typicalMonthly)}.`
            : `Sprzedaż regularna (${meta.activeWindows} z ${meta.windows.length} miesięcy).`;
  const prosba =
    meta.prosbaPieces > 0 ? ` W oknie ${fmt(meta.prosbaPieces)} szt z zrealizowanych próśb.` : "";
  const applied = meta.applied
    ? ` Wygładzono: sprzedaż w oknie ${fmt(meta.rawSprzedazOkres)} → ${fmt(meta.rawSprzedazOkres * meta.factor)} szt.`
    : "";
  return `${head}${prosba}${applied} Ostatnie 12 × 30 dni: ${series}.`;
}
