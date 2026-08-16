/**
 * Kreator listy do zamówienia ZD — tryb „jak ręcznie”.
 *
 * Proces ręczny (zakupy):
 * 1. Wybór zakresu w Subiekcie — grupa towarowa (np. Falcon) albo cecha (np. Ivoclar).
 * 2. Dla każdego produktu: sprzedaż w okresie ≈ zapas dostawcy (OnTime).
 * 3. Porównanie ze stanem dostępnym.
 * 4. Odjęcie ilości już na otwartych ZD.
 *
 * Formuła qty (bez otwartych ZK — ZK tylko informacyjnie):
 *   doZamowieniaReczne = max(0, ceil(celŚledzony − dostepne − otwarteZd))
 *   `dostepne` może być ujemne (stan − rezerwacje) — dług rezerwacji
 *   powiększa zamówienie (cel − (−28) = cel + 28).
 *   `otwarteZd` nadal clamp ≥ 0.
 *
 * celZapasu liczy API: (sprzedazOkres / dniOkresu) × dniZapasu + zapasMin
 * celŚledzony = celZapasu ± korekta „podążania za sprzedażą”
 *   (cienkie/grube pokrycie, sell-through, martwy SKU — zd-estimate-sales-track).
 * Gdy dniOkresu ≈ dniZapasu, cel ≈ sprzedaż w oknie zapasu.
 */

import type { OrderInterval } from "@/lib/orders/dates";
import { resolveSupplierInterval } from "@/lib/orders/dates";
import {
  computeSalesTrackedCel,
  reconcileSalesTrackQtyMetaAfterHistory,
  resolveSprzedazDziennie,
  type SalesTrackReason,
} from "@/lib/orders/zd-estimate-sales-track";
import { applyZdEstimateHistoryCuts } from "@/lib/orders/zd-estimate-history-track";
import {
  isPackagingPackagesMode,
  normalizePackagingDocumentUnitMode,
  normalizeUnitsPerPackage,
  zdDocumentUnitsToPieces,
} from "@/lib/orders/zd-estimate-units";
import {
  applyBomPurchaseTargetFinalize,
  applyZdEstimateBoms,
  type ZdProductBomRef,
} from "@/lib/orders/zd-estimate-bom";
import {
  applyZdEstimatePairs,
  effectiveUnitsPerPackageForTwId,
} from "@/lib/orders/zd-estimate-pairs";
import {
  indexZdProductPairs,
  type ZdProductPairRef,
} from "@/lib/orders/zd-product-pair-units";
import type {
  SubiektZdEstimateLine,
  SubiektZdEstimateParams,
} from "@/lib/subiekt/types";

/** Domyślny zapas w dniach, gdy brak ustawienia dostawcy. */
export const DEFAULT_DNI_ZAPASU = 30;

/** Bezpieczny limit stron przy dociąganiu całego zakresu z API. */
export const ZD_ESTIMATE_MAX_PAGES = 40;

/** pageSize przy dociąganiu (max API = 200). */
export const ZD_ESTIMATE_PAGE_SIZE = 200;

export type ManualZdEstimateLine = {
  tw_Id: number;
  tw_Symbol: string;
  tw_Nazwa: string;
  /** Kod Mikran / PLU z Subiekta (gdy API zwraca). */
  tw_PLU?: string | null;
  tw_IdGrupa: number | null;
  grt_Nazwa: string;
  tw_Stan: number;
  tw_StanRez: number;
  dostepne: number;
  sprzedazOkres: number;
  sprzedazDziennie: number;
  /** Cel z API Subiekta (bez podbicia). */
  celZapasu: number;
  /** Cel po podążaniu za sprzedażą — używany do qty. */
  celZapasuTracked: number;
  /** Signed delta celu ze śledzenia sprzedaży (+/−). */
  salesTrackDelta: number;
  salesTrackReasons: SalesTrackReason[];
  /** 0..1 — pewność dokupu sztuk z boostu. */
  salesTrackConfidence: number;
  /** Wątpliwa ilość — filtr „Do weryfikacji”. */
  salesTrackQtyReview: boolean;
  /** Sztuki wstrzymane względem pełnego boostu. */
  salesTrackHeldExtraQty: number;
  /** Sztuki Do ZD dozwolone ponad bazę z boostu. */
  salesTrackAllowedExtraQty: number;
  otwarteZkBezRez: number;
  otwarteZkZarezerwowane: number;
  otwarteZd: number;
  /** Surowy wynik API (z ZK) — nie używany jako qty zamówienia. */
  doZamowieniaApi: number;
  /**
   * Ilość do wrzucenia na listę — jak ręcznie:
   * max(0, ceil(celTracked − dostepne − otwarteZd)); dostepne może być ujemne.
   */
  doZamowieniaReczne: number;
  /** Różnica API − ręcznie (= wkład otwartych ZK bez rez. przy typowych danych). */
  wkladZk: number;
  /** Meta pary montaż/demontaż (gdy SKU w zd_product_pairs). */
  pair?: import("@/lib/orders/zd-estimate-pairs").ZdEstimatePairMeta | null;
  /** Meta składu/promocji (BOM). */
  bom?: import("@/lib/orders/zd-estimate-bom").ZdEstimateBomMeta | null;
};

export type ManualZdEstimateResult = {
  parametry: SubiektZdEstimateParams;
  pozycje: ManualZdEstimateLine[];
  /**
   * Linie 1:1 z Subiekta (sales-track solo), **przed** BOM i parami.
   * UI trzyma to do natychmiastowego przeliczenia po zmianie BOM/par/opakowań
   * bez ponownego API (o ile partnerzy/komponenty są już w zakresie).
   */
  pozycjeBase: ManualZdEstimateLine[];
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
 * `otwarteZd` clamp ≥ 0.
 * `dostepne` bez dolnego clampu: ujemne (rezerwacje > stan) zwiększa
 * potrzebę, żeby Do ZD pokryło dług rezerwacji względem celu.
 * `celZapasu` tu = cel już po ewentualnym śledzeniu sprzedaży.
 */
export function computeManualOrderQty(input: {
  celZapasu: number;
  dostepne: number;
  otwarteZd: number;
}): number {
  const cel = asFiniteNumber(input.celZapasu);
  const dostepne = asFiniteNumber(input.dostepne);
  const otwarteZd = Math.max(0, asFiniteNumber(input.otwarteZd));
  const raw = cel - dostepne - otwarteZd;
  if (!(raw > 0)) return 0;
  return Math.ceil(raw - Number.EPSILON);
}

export type MapZdEstimateLineOptions = {
  /** Dni zapasu dostawcy / run — do oceny cienkiego pokrycia. */
  dniZapasu?: number | null;
  /** Długość okna FS z API — fallback tempa dziennego. */
  dniOkresu?: number | null;
  /** Domyślnie true — podążanie za sprzedażą. */
  salesTrack?: boolean;
  /** Domyślnie true — sygnały cięcia (fat cover / low ST / dead). */
  salesTrackCuts?: boolean;
  /** Ostatnie zamówienie z snapshotu ZD (Faza 3) — qty w sztukach. */
  history?: { lastOrderedQty: number; linkedAt: string } | null;
  /**
   * Sztuk na 1 jednostkę ZD — do cover/qty (otwarte ZD z API = paczki w Mode A).
   * 1 / brak = traktuj otwarte ZD jako sztuki.
   */
  unitsPerPackage?: number | null;
  /** Mode B: otwarte ZD już w sztukach — bez × N. */
  documentUnitMode?: import("@/lib/orders/zd-estimate-units").ZdPackagingDocumentUnitMode | null;
  /** Wspólna polityka mocy boosta (presety). */
  salesTrackPolicy?: Partial<
    typeof import("@/lib/orders/zd-estimate-sales-track").ZD_SALES_TRACK
  > | null;
};

export function mapZdEstimateLineToManual(
  line: SubiektZdEstimateLine,
  options?: MapZdEstimateLineOptions
): ManualZdEstimateLine {
  const tw_Stan = asFiniteNumber(line.tw_Stan);
  const tw_StanRez = asFiniteNumber(line.tw_StanRez);
  const dostepne =
    line.dostepne == null
      ? tw_Stan - tw_StanRez
      : asFiniteNumber(line.dostepne);

  const celZapasu = asFiniteNumber(line.celZapasu);
  const sprzedazOkres = asFiniteNumber(line.sprzedazOkres);
  const sprzedazDziennieRaw = asFiniteNumber(line.sprzedazDziennie);
  const otwarteZd = asFiniteNumber(line.otwarteZd);
  const otwarteZdPieces = zdDocumentUnitsToPieces(
    otwarteZd,
    options?.unitsPerPackage,
    options?.documentUnitMode
  );
  const otwarteZkBezRez = asFiniteNumber(line.otwarteZkBezRez);
  // Live remat dostaje ManualZdEstimateLine (doZamowieniaApi), nie surowy wiersz API.
  const doZamowieniaApi = asFiniteNumber(
    line.doZamowienia ??
      (line as { doZamowieniaApi?: unknown }).doZamowieniaApi
  );

  const dniZapasu =
    options?.dniZapasu != null && Number.isFinite(options.dniZapasu)
      ? Number(options.dniZapasu)
      : DEFAULT_DNI_ZAPASU;

  const dniOkresu =
    options?.dniOkresu != null && Number.isFinite(options.dniOkresu)
      ? Number(options.dniOkresu)
      : null;

  const track = computeSalesTrackedCel({
    celZapasu,
    sprzedazOkres,
    sprzedazDziennie: sprzedazDziennieRaw,
    dostepne,
    otwarteZd: otwarteZdPieces,
    dniZapasu,
    dniOkresu,
    enabled: options?.salesTrack !== false,
    cutsEnabled: options?.salesTrackCuts !== false,
    policy: options?.salesTrackPolicy ?? undefined,
  });

  let celTracked = track.celTracked;
  let salesTrackDelta = track.deltaPieces;
  let salesTrackReasons: SalesTrackReason[] = [...track.reasons];
  const salesTrackConfidence = track.confidence;
  let salesTrackQtyReview = track.qtyReview;
  let salesTrackHeldExtraQty = track.heldExtraQty;
  let salesTrackAllowedExtraQty = track.allowedExtraQty;

  const hist = options?.history;
  // History cut: prawdziwe dostępne (może być ujemne). Qty liczy się osobno.
  const coverForQty = dostepne + otwarteZdPieces;
  if (
    hist &&
    options?.salesTrack !== false &&
    options?.salesTrackCuts !== false
  ) {
    const tempo = resolveSprzedazDziennie({
      sprzedazOkres,
      sprzedazDziennie: sprzedazDziennieRaw,
      dniOkresu,
      fallbackDniOkresu: dniZapasu,
    });
    const histAdj = applyZdEstimateHistoryCuts({
      celTracked,
      celBase: celZapasu,
      sprzedazOkres,
      sprzedazDziennie: tempo,
      coverStock: coverForQty,
      dniZapasu,
      dniOkresu,
      lastOrderedQty: hist.lastOrderedQty,
      linkedAt: hist.linkedAt,
    });
    if (histAdj.reasons.length > 0) {
      celTracked = histAdj.celTracked;
      salesTrackDelta = celTracked - celZapasu;
      salesTrackReasons.push(...histAdj.reasons);
      const reconciled = reconcileSalesTrackQtyMetaAfterHistory({
        celBase: celZapasu,
        celTracked,
        coverStock: coverForQty,
        confidence: salesTrackConfidence,
        reasons: salesTrackReasons,
        policy: options?.salesTrackPolicy ?? undefined,
      });
      salesTrackReasons = reconciled.salesTrackReasons;
      salesTrackQtyReview = reconciled.salesTrackQtyReview;
      salesTrackHeldExtraQty = reconciled.salesTrackHeldExtraQty;
      salesTrackAllowedExtraQty = reconciled.salesTrackAllowedExtraQty;
    }
  }

  const doZamowieniaReczne = computeManualOrderQty({
    celZapasu: celTracked,
    dostepne,
    otwarteZd: otwarteZdPieces,
  });

  return {
    tw_Id: asFiniteNumber(line.tw_Id),
    tw_Symbol: String(line.tw_Symbol ?? "").trim() || "—",
    tw_Nazwa: String(line.tw_Nazwa ?? "").trim() || "—",
    tw_PLU: (() => {
      const raw = line.tw_PLU ?? (line as { Tw_PLU?: unknown }).Tw_PLU;
      const s = String(raw ?? "").trim();
      return s && s !== "-" ? s : null;
    })(),
    tw_IdGrupa: asOptionalInt(line.tw_IdGrupa),
    grt_Nazwa: String(line.grt_Nazwa ?? "").trim() || "—",
    tw_Stan,
    tw_StanRez,
    dostepne,
    sprzedazOkres,
    sprzedazDziennie: sprzedazDziennieRaw,
    celZapasu,
    celZapasuTracked: celTracked,
    salesTrackDelta,
    salesTrackReasons,
    salesTrackConfidence,
    salesTrackQtyReview,
    salesTrackHeldExtraQty,
    salesTrackAllowedExtraQty,
    otwarteZkBezRez,
    otwarteZkZarezerwowane: asFiniteNumber(line.otwarteZkZarezerwowane),
    otwarteZd,
    doZamowieniaApi,
    doZamowieniaReczne,
    wkladZk: Math.max(0, doZamowieniaApi - doZamowieniaReczne),
  };
}

export type ZdEstimateSoloMapOptions = {
  dniZapasu: number;
  dniOkresu?: number | null;
  salesTrack?: boolean;
  salesTrackCuts?: boolean;
  salesTrackPolicy?: Partial<
    typeof import("@/lib/orders/zd-estimate-sales-track").ZD_SALES_TRACK
  > | null;
  historyByTwId?: ReadonlyMap<
    number,
    { lastOrderedQty: number; linkedAt: string }
  > | null;
  packagingByTwId?: ReadonlyMap<
    number,
    {
      unitsPerPackage: number;
      documentUnitMode?: import("@/lib/orders/zd-estimate-units").ZdPackagingDocumentUnitMode | null;
    }
  > | null;
  productPairs?: readonly ZdProductPairRef[] | null;
};

/**
 * Solo map 1:1 (track + history + opakowanie → cover w sztukach).
 * Pary: track/history wyłączone — merge w applyZdEstimatePairs.
 * Live refresh woła to przy zmianie opakowania, żeby celTracked nie został
 * ze starego N / trybu A↔B.
 */
export function mapZdEstimateLinesSolo(
  lines: readonly SubiektZdEstimateLine[],
  options: ZdEstimateSoloMapOptions
): ManualZdEstimateLine[] {
  const dniZapasu = Math.max(1, Math.round(options.dniZapasu));
  const historyByTwId = options.historyByTwId ?? null;
  const packagingByTwId = options.packagingByTwId ?? null;
  const pairIndex = indexZdProductPairs(options.productPairs ?? []);

  return lines.map((line) => {
    const twId = asFiniteNumber(line.tw_Id);
    const inPair = pairIndex.has(twId);
    const hist = inPair ? null : historyByTwId?.get(twId) ?? null;
    const packRow = packagingByTwId?.get(twId);
    const packUnits = effectiveUnitsPerPackageForTwId(
      twId,
      pairIndex,
      packRow?.unitsPerPackage
    );
    return mapZdEstimateLineToManual(line, {
      dniZapasu,
      dniOkresu: options.dniOkresu,
      salesTrack: inPair ? false : options.salesTrack,
      salesTrackCuts: inPair ? false : options.salesTrackCuts,
      salesTrackPolicy: options.salesTrackPolicy,
      history: hist,
      unitsPerPackage: packUnits,
      documentUnitMode: inPair ? "packages" : packRow?.documentUnitMode,
    });
  });
}

export function buildManualZdEstimateResult(
  parametry: SubiektZdEstimateParams,
  lines: SubiektZdEstimateLine[],
  options?: {
    onlyManualBraki?: boolean;
    /** Domyślnie true. */
    salesTrack?: boolean;
    /** Domyślnie true. */
    salesTrackCuts?: boolean;
    /** Wspólna polityka mocy boosta (presety). */
    salesTrackPolicy?: Partial<
      typeof import("@/lib/orders/zd-estimate-sales-track").ZD_SALES_TRACK
    > | null;
    /** tw_Id → ostatnie zamówienie ze snapshotu (qty w sztukach). */
    historyByTwId?: ReadonlyMap<
      number,
      { lastOrderedQty: number; linkedAt: string }
    > | null;
    /** tw_Id → sztuk / 1 jednostka ZD. */
    packagingByTwId?: ReadonlyMap<
      number,
      {
        unitsPerPackage: number;
        documentUnitMode?: import("@/lib/orders/zd-estimate-units").ZdPackagingDocumentUnitMode | null;
      }
    > | null;
    /** Pary pack↔piece. */
    productPairs?: readonly ZdProductPairRef[] | null;
    /** Składy/promocje (BOM) — przed parami. */
    productBoms?: readonly ZdProductBomRef[] | null;
    /** Partnerzy których nie udało się dociągnąć. */
    missingPartnerTwIds?: ReadonlySet<number> | null;
    /** Komponenty BOM których nie udało się dociągnąć. */
    missingBomTwIds?: ReadonlySet<number> | null;
    /** Wykluczenia (pack wykluczony → qty 0). */
    excludedTwIds?: ReadonlySet<number> | null;
    zapasMin?: number | null;
  }
): ManualZdEstimateResult {
  const onlyManualBraki = options?.onlyManualBraki === true;
  const dniZapasu =
    parametry.dniZapasu != null && Number.isFinite(Number(parametry.dniZapasu))
      ? Number(parametry.dniZapasu)
      : DEFAULT_DNI_ZAPASU;
  const dniOkresu =
    parametry.dniOkresu != null && Number.isFinite(Number(parametry.dniOkresu))
      ? Number(parametry.dniOkresu)
      : null;
  const historyByTwId = options?.historyByTwId ?? null;
  const packagingByTwId = options?.packagingByTwId ?? null;
  const pairs = options?.productPairs ?? [];
  const boms = options?.productBoms ?? [];
  const zapasMin =
    options?.zapasMin ??
    (parametry.zapasMin != null ? Number(parametry.zapasMin) : 0);

  const mapped = mapZdEstimateLinesSolo(lines, {
    dniZapasu,
    dniOkresu,
    salesTrack: options?.salesTrack,
    salesTrackCuts: options?.salesTrackCuts,
    salesTrackPolicy: options?.salesTrackPolicy,
    historyByTwId,
    packagingByTwId,
    productPairs: pairs,
  });

  const pozycjeBase = mapped.map((l) => ({
    ...l,
    pair: null as null,
    bom: null as null,
  }));

  const afterBom =
    boms.length > 0
      ? applyZdEstimateBoms(mapped, boms, {
          dniZapasu,
          dniOkresu,
          zapasMin,
          salesTrack: options?.salesTrack,
          salesTrackCuts: options?.salesTrackCuts,
          salesTrackPolicy: options?.salesTrackPolicy,
          historyByTwId,
          packagingByTwId,
          productPairs: pairs,
          missingComponentTwIds: options?.missingBomTwIds,
        })
      : mapped.map((l) => ({ ...l, bom: null as null }));

  const withPairs =
    pairs.length > 0
      ? applyZdEstimatePairs(afterBom, pairs, {
          dniZapasu,
          dniOkresu,
          zapasMin,
          salesTrack: options?.salesTrack,
          salesTrackCuts: options?.salesTrackCuts,
          salesTrackPolicy: options?.salesTrackPolicy,
          excludedTwIds: options?.excludedTwIds,
          historyByTwId,
          missingPartnerTwIds: options?.missingPartnerTwIds,
        })
      : afterBom.map((l) => ({ ...l, pair: null }));

  const finalized = applyBomPurchaseTargetFinalize(withPairs);

  const orderSummary = summarizeManualOrderQty(finalized);

  const pozycje = onlyManualBraki
    ? finalized.filter((p) => p.doZamowieniaReczne > 0)
    : finalized;

  pozycje.sort((a, b) => {
    if (b.doZamowieniaReczne !== a.doZamowieniaReczne) {
      return b.doZamowieniaReczne - a.doZamowieniaReczne;
    }
    return a.tw_Symbol.localeCompare(b.tw_Symbol, "pl");
  });

  return {
    parametry,
    pozycje,
    pozycjeBase,
    totalFromSubiekt: finalized.length,
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
  documentUnitMode?: import("@/lib/orders/zd-estimate-units").ZdPackagingDocumentUnitMode | null;
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
    "cel_sledzony",
    "delta_sledzenia",
    "otwarte_zd",
    "otwarte_zk_bez_rez",
    "tw_Id",
  ].join("\t");

  // Thin Mode A/B math (bez importu packaging — cykl). Preferuj orderableLinesToTsv.
  const rows = lines.map((l) => {
    const pack = packagingByTwId?.get(l.tw_Id) ?? null;
    const units = normalizeUnitsPerPackage(pack?.unitsPerPackage);
    const mode = normalizePackagingDocumentUnitMode(pack?.documentUnitMode);
    const pieces = Math.max(0, Math.ceil(Number(l.doZamowieniaReczne) || 0));
    let zd: number;
    let arriving: number;
    if (units <= 1 || pieces <= 0) {
      zd = pieces;
      arriving = pieces;
    } else if (!isPackagingPackagesMode(mode)) {
      arriving = Math.ceil(pieces / units) * units;
      zd = arriving;
    } else {
      zd = Math.ceil(pieces / units);
      arriving = zd * units;
    }
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
      formatQty(l.celZapasuTracked),
      Math.abs(l.salesTrackDelta) > 1e-9 ? formatQty(l.salesTrackDelta) : "",
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
