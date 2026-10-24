/**
 * Czasy dostaw z Subiekta: ZD (wysłane do dostawcy) → FZ (towar przyjęty).
 *
 * Reguły (zweryfikowane na historii 2006–2026):
 * - start = data wystawienia ZD (ZD jest tworzone i wysyłane od razu),
 * - koniec = data magazynowa FZ (`dok_DataMag`) — FZ wpisujemy w dniu przyjścia towaru,
 * - FZ po zamknięciu miesiąca dostaje datę ostatniego dnia miesiąca (np. ZD 27.10, towar 03.11 →
 *   FZ z datą 31.10), więc FZ z datą ostatniego dnia miesiąca nie mówi, kiedy towar przyszedł —
 *   zamówienie z taką FZ nie jest próbką (decyzja zakupów 2026-10-24; wcześniej data była
 *   szacowana z numeracji, co dawało przybliżenie, nie pomiar),
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
  /** Zawsze false — zamówień z FZ na koniec miesiąca nie liczymy (pole zostaje dla kolumny `date_corrected`). */
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
    /** Zamówienia pominięte: któraś FZ z datą ostatniego dnia miesiąca (data wpisu, nie przyjęcia). */
    monthEndExcluded: number;
  };
};

function isLastDayOfMonth(dateKey: string): boolean {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.getUTCDate() === 1;
}

export function analyzeSubiektLeadTimes(docs: SubiektPurchaseDoc[]): SubiektLeadTimeAnalysis {
  const zds = docs.filter((d) => d.typ === SUBIEKT_DOC_TYPE_ZD && d.dataWyst);
  const fzs = docs.filter((d) => d.typ === SUBIEKT_DOC_TYPE_FZ && (d.dataMag || d.dataWyst));
  const zdById = new Map(zds.map((d) => [d.dokId, d]));

  const arrivalByZd = new Map<number, { fzId: number; date: string; monthEnd: boolean }>();
  for (const fz of fzs) {
    if (fz.doDokId == null || !zdById.has(fz.doDokId)) continue;
    const date = (fz.dataMag ?? fz.dataWyst)!;
    arrivalByZd.set(fz.doDokId, { fzId: fz.dokId, date, monthEnd: isLastDayOfMonth(date) });
  }
  let monthEndExcluded = 0;

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
    // FZ z datą ostatniego dnia miesiąca = data wpisu po zamknięciu miesiąca, nie przyjęcia.
    if (arrivals.some((a) => a.monthEnd)) {
      monthEndExcluded++;
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
      dateCorrected: false,
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
      monthEndExcluded,
    },
  };
}
