/**
 * Czasy dostaw z Subiekta: ZD (wysłane do dostawcy) → FZ (towar przyjęty).
 *
 * Reguły (zweryfikowane na historii 2006–2026):
 * - start = data wystawienia ZD (ZD jest tworzone i wysyłane od razu),
 * - koniec = data magazynowa FZ (`dok_DataMag`) — FZ wpisujemy w dniu przyjścia towaru,
 * - FZ po zamknięciu miesiąca dostaje datę ostatniego dnia poprzedniego miesiąca
 *   (np. towar 02.10 → FZ z datą 30.09). `dok_Id` rośnie z czasem wprowadzenia, więc
 *   prawdziwy dzień wpisu ≥ data ZD wprowadzonych tuż przed tą FZ — korygujemy WYŁĄCZNIE
 *   ten przypadek (data = ostatni dzień miesiąca, wpis w kolejnym). Zwykły wpis FZ dzień
 *   czy weekend później ma prawdziwą datę przyjęcia — tej nie ruszamy,
 * - każde ZD ma ≤1 FZ; resztę zamówienia Subiekt przenosi do nowego ZD „braki”
 *   (`dok_DoDokId` → poprzednie ZD). Łańcuch u tego samego dostawcy = jedno zamówienie:
 *   pierwsza dostawa = najwcześniejsza FZ, pełna = ostatnia FZ łańcucha,
 * - łańcuch z otwartym ZD (status ≠ zrealizowane) czeka — nie jest jeszcze próbką.
 */
import { businessDaysBetweenWarsawDateKeys } from "@/lib/orders/delivery-stats-aggregation";

export const SUBIEKT_DOC_TYPE_FZ = 1;
export const SUBIEKT_DOC_TYPE_ZD = 15;
/** dok_Status ZD: 8 = zrealizowane; 5/6/7 = otwarte. */
export const SUBIEKT_ZD_STATUS_DONE = 8;
/** Korekta wpisu po zamknięciu miesiąca — dłuższe przesunięcia to anomalia, nie korekta. */
export const MAX_ENTRY_DATE_CORRECTION_DAYS = 14;
/** Ponad rok roboczy = błąd w dokumentach, nie czas dostawy. */
export const MAX_LEAD_TIME_BUSINESS_DAYS = 250;

export type SubiektPurchaseDoc = {
  dokId: number;
  typ: number;
  khId: number | null;
  /** yyyy-mm-dd */
  dataWyst: string | null;
  /** yyyy-mm-dd */
  dataMag: string | null;
  status: number | null;
  doDokId: number | null;
};

export type SubiektLeadTimeSample = {
  /** Pierwsze ZD łańcucha (start zamówienia). */
  zdId: number;
  /** FZ, która domknęła zamówienie. */
  lastFzId: number;
  khId: number;
  placementDate: string;
  firstDeliveryDate: string;
  deliveryDate: string;
  businessDaysFirst: number;
  businessDaysFull: number;
  chainLength: number;
  fzCount: number;
  /** Któraś FZ łańcucha miała datę cofniętą na koniec miesiąca. */
  dateCorrected: boolean;
};

export type SubiektLeadTimeAnalysis = {
  samples: SubiektLeadTimeSample[];
  counts: {
    zd: number;
    fz: number;
    orders: number;
    openOrders: number;
    withoutFz: number;
    outliers: number;
    corrected: number;
    anomalousEntryDates: number;
  };
};

function isLastDayOfMonth(dateKey: string): boolean {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.getUTCDate() === 1;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/**
 * Data wprowadzenia dokumentu odczytana z numeracji: mediana dat 3 ZD
 * wprowadzonych bezpośrednio przed nim (odporne na pojedyncze literówki w datach).
 */
function entryLowerBoundFinder(zdSortedById: SubiektPurchaseDoc[]) {
  const ids = zdSortedById.map((d) => d.dokId);
  return (dokId: number): string | null => {
    let lo = 0;
    let hi = ids.length - 1;
    let idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (ids[mid]! < dokId) {
        idx = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (idx < 0) return null;
    const dates = zdSortedById
      .slice(Math.max(0, idx - 2), idx + 1)
      .map((d) => d.dataWyst!)
      .sort();
    return dates[dates.length >> 1] ?? null;
  };
}

export function analyzeSubiektLeadTimes(docs: SubiektPurchaseDoc[]): SubiektLeadTimeAnalysis {
  const zds = docs.filter((d) => d.typ === SUBIEKT_DOC_TYPE_ZD && d.dataWyst);
  const fzs = docs.filter((d) => d.typ === SUBIEKT_DOC_TYPE_FZ && (d.dataMag || d.dataWyst));
  const zdById = new Map(zds.map((d) => [d.dokId, d]));
  const entryLowerBound = entryLowerBoundFinder([...zds].sort((a, b) => a.dokId - b.dokId));

  let corrected = 0;
  let anomalousEntryDates = 0;
  const arrivalByZd = new Map<number, { fzId: number; date: string; corrected: boolean }>();
  for (const fz of fzs) {
    if (fz.doDokId == null || !zdById.has(fz.doDokId)) continue;
    const printed = (fz.dataMag ?? fz.dataWyst)!;
    const entered = entryLowerBound(fz.dokId);
    let date = printed;
    let wasCorrected = false;
    // Tylko FZ cofnięta na ostatni dzień miesiąca, a wpisana już w następnym.
    if (entered && isLastDayOfMonth(printed) && entered.slice(0, 7) > printed.slice(0, 7)) {
      if (daysBetween(printed, entered) <= MAX_ENTRY_DATE_CORRECTION_DAYS) {
        date = entered;
        wasCorrected = true;
        corrected++;
      } else {
        anomalousEntryDates++;
      }
    }
    arrivalByZd.set(fz.doDokId, { fzId: fz.dokId, date, corrected: wasCorrected });
  }

  // „Braki” u innego dostawcy = nowe zamówienie (przekierowanie), nie ciąg dalszy.
  const parentInChain = (zd: SubiektPurchaseDoc) => {
    const parent = zd.doDokId != null ? zdById.get(zd.doDokId) : undefined;
    return parent && parent.khId === zd.khId ? parent : undefined;
  };
  const children = new Map<number, SubiektPurchaseDoc[]>();
  for (const zd of zds) {
    const parent = parentInChain(zd);
    if (!parent) continue;
    const list = children.get(parent.dokId) ?? [];
    list.push(zd);
    children.set(parent.dokId, list);
  }

  const samples: SubiektLeadTimeSample[] = [];
  let orders = 0;
  let openOrders = 0;
  let withoutFz = 0;
  let outliers = 0;

  for (const root of zds) {
    if (parentInChain(root) || root.khId == null) continue;
    orders++;
    const chain = [root];
    const seen = new Set([root.dokId]);
    for (let i = 0; i < chain.length; i++) {
      for (const child of children.get(chain[i]!.dokId) ?? []) {
        if (seen.has(child.dokId)) continue;
        seen.add(child.dokId);
        chain.push(child);
      }
    }
    if (chain.some((zd) => zd.status !== SUBIEKT_ZD_STATUS_DONE)) {
      openOrders++;
      continue;
    }
    const arrivals = chain
      .map((zd) => arrivalByZd.get(zd.dokId))
      .filter((a): a is NonNullable<typeof a> => a != null)
      .sort((a, b) => a.date.localeCompare(b.date) || a.fzId - b.fzId);
    if (!arrivals.length) {
      withoutFz++;
      continue;
    }
    const first = arrivals[0]!;
    const last = arrivals[arrivals.length - 1]!;
    const placementDate = root.dataWyst!;
    const businessDaysFirst = businessDaysBetweenWarsawDateKeys(placementDate, first.date);
    const businessDaysFull = businessDaysBetweenWarsawDateKeys(placementDate, last.date);
    if (
      businessDaysFirst == null ||
      businessDaysFull == null ||
      businessDaysFull > MAX_LEAD_TIME_BUSINESS_DAYS
    ) {
      outliers++;
      continue;
    }
    samples.push({
      zdId: root.dokId,
      lastFzId: last.fzId,
      khId: root.khId,
      placementDate,
      firstDeliveryDate: first.date,
      deliveryDate: last.date,
      businessDaysFirst,
      businessDaysFull,
      chainLength: chain.length,
      fzCount: arrivals.length,
      dateCorrected: arrivals.some((a) => a.corrected),
    });
  }

  return {
    samples,
    counts: {
      zd: zds.length,
      fz: fzs.length,
      orders,
      openOrders,
      withoutFz,
      outliers,
      corrected,
      anomalousEntryDates,
    },
  };
}
