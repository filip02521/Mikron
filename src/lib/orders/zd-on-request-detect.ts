/**
 * Wykrywanie towaru „na prośbę” z historii: po wpisie faktury zakupu (FZ) jeden klient w ciągu kilku dni
 * bierze całą dostawę, a takie zakupy to większość sprzedaży towaru (towar nie leży na półce dla wszystkich).
 *
 * Sprawdzone na danych (10.2026, 114 towarów oznaczonych „tylko na prośbę” i 150 zwykłych):
 * okno −7…+21 dni od FZ, próg 80% dostawy, ≥ 2/3 dostaw i ≥ 50% sprzedaży → 54% oznaczonych,
 * 3% zwykłych (a te 3% to w praktyce nieoznaczone towary na prośbę, np. 12 szt → 12 szt jednemu klientowi).
 * Czyste funkcje — serwer i klient.
 */

export type OnRequestDelivery = {
  /** Data wpisu FZ (albo przybliżona: ZD + kilka dni, gdy faktura niepowiązana). */
  date: string;
  pieces: number;
};

export type OnRequestSale = {
  date: string;
  /** Klient (kh_Id albo symbol) — „ten sam klient” w oknie dostawy. */
  khKey: string;
  khName?: string | null;
  pieces: number;
};

export const ZD_ON_REQUEST_WINDOW_BEFORE_DAYS = 7;
export const ZD_ON_REQUEST_WINDOW_AFTER_DAYS = 21;
/** Jeden klient bierze co najmniej tyle dostawy, żeby „brał całość” (resztki, zaokrąglenia). */
export const ZD_ON_REQUEST_TAKE_SHARE = 0.8;
export const ZD_ON_REQUEST_MIN_DELIVERY_SHARE = 2 / 3;
export const ZD_ON_REQUEST_MIN_SALES_SHARE = 0.5;
/** Oznaczony „na prośbę”, a kupuje go tylu klientów w roku — sprzedaje się jak magazynowy. */
export const ZD_ON_REQUEST_STOCK_LIKE_CUSTOMERS = 8;

export type OnRequestPattern = {
  /** Dostawy z datą w historii. */
  deliveries: number;
  /** Dostawy, które w oknie wziął w całości jeden klient. */
  takenWhole: number;
  /** Część całej sprzedaży, która to te przejęcia dostaw (0–1). */
  salesShare: number;
  soldPieces: number;
  customers: number;
  /** Klient, który najczęściej bierze całą dostawę. */
  topCustomer: string | null;
  /** Wygląda na towar na prośbę (spełnia oba progi). */
  likely: boolean;
  /** Sprzedaje się do wielu klientów — „na prośbę” prawdopodobnie błędne. */
  stockLike: boolean;
};

const dayNum = (key: string) => Date.parse(`${key.slice(0, 10)}T00:00:00Z`) / 86_400_000;

export function detectOnRequestPattern(
  deliveries: readonly OnRequestDelivery[],
  sales: readonly OnRequestSale[],
  /** Dzień liczenia (YYYY-MM-DD): dostawa świeższa niż okno liczy się tylko, gdy już ktoś ją wziął w całości. */
  asOf?: string
): OnRequestPattern {
  const sold = sales.filter((s) => s.pieces > 0);
  const soldPieces = sold.reduce((a, s) => a + s.pieces, 0);
  const customers = new Set(sold.map((s) => s.khKey)).size;
  let counted = 0;
  let takenWhole = 0;
  let tied = 0;
  const wins = new Map<string, { n: number; name: string }>();
  const windowOpenFrom = asOf ? dayNum(asOf) - ZD_ON_REQUEST_WINDOW_AFTER_DAYS : Infinity;
  for (const d of deliveries) {
    if (!(d.pieces > 0) || !d.date) continue;
    const at = dayNum(d.date);
    const byKh = new Map<string, number>();
    for (const s of sold) {
      const sd = dayNum(s.date);
      if (sd >= at - ZD_ON_REQUEST_WINDOW_BEFORE_DAYS && sd <= at + ZD_ON_REQUEST_WINDOW_AFTER_DAYS) {
        byKh.set(s.khKey, (byKh.get(s.khKey) ?? 0) + s.pieces);
      }
    }
    let topKey: string | null = null;
    let top = 0;
    for (const [k, q] of byKh) if (q > top) [topKey, top] = [k, q];
    const taken = topKey != null && top >= ZD_ON_REQUEST_TAKE_SHARE * d.pieces;
    // Okno jeszcze otwarte, a nikt nie wziął całości — za wcześnie, żeby liczyć to przeciw „na prośbę”.
    if (!taken && at > windowOpenFrom) continue;
    counted++;
    if (taken && topKey != null) {
      takenWhole++;
      tied += top;
      const name = sold.find((s) => s.khKey === topKey)?.khName?.trim() || topKey;
      const w = wins.get(topKey) ?? { n: 0, name };
      w.n++;
      wins.set(topKey, w);
    }
  }
  const salesShare = soldPieces > 0 ? Math.min(1, tied / soldPieces) : 0;
  const topCustomer = [...wins.values()].sort((a, b) => b.n - a.n)[0]?.name ?? null;
  return {
    deliveries: counted,
    takenWhole,
    salesShare,
    soldPieces,
    customers,
    topCustomer,
    likely:
      counted > 0 &&
      takenWhole / counted >= ZD_ON_REQUEST_MIN_DELIVERY_SHARE &&
      salesShare >= ZD_ON_REQUEST_MIN_SALES_SHARE,
    stockLike: customers >= ZD_ON_REQUEST_STOCK_LIKE_CUSTOMERS,
  };
}

/** Klient sprzedaży: kh_Id, bez niego symbol; sprzedaż bez klienta (paragon) każda osobno — nie „jeden klient”. */
export function onRequestCustomerKey(row: { khId?: number | null; khSymbol?: string | null }, docKey: string | number): string {
  if (row.khId != null && row.khId > 0) return String(row.khId);
  return row.khSymbol?.trim() || `anon:${docKey}`;
}

/** ZD otwarty bez faktury jest jeszcze w drodze — to nie dostawa, którą ktoś mógł już wziąć. */
export function isOnRequestDeliveryArrived(row: { fzDate?: string | null; zdDone?: boolean | null }): boolean {
  return Boolean(row.fzDate) || row.zdDone !== false;
}

/** Data dostawy do wykrywania: FZ, a bez powiązanej FZ — ZD + typowe kilka dni dostawy. */
export function onRequestDeliveryDate(row: { fzDate?: string | null; zdDate: string | null }, fallbackLeadDays = 5): string | null {
  if (row.fzDate) return row.fzDate;
  if (!row.zdDate) return null;
  const t = new Date(`${row.zdDate.slice(0, 10)}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + fallbackLeadDays);
  return t.toISOString().slice(0, 10);
}

/** „3 z 3 dostaw wziął w całości jeden klient (najczęściej X) — 90% sprzedaży”. */
export function onRequestPatternSummary(p: OnRequestPattern): string {
  const who = p.topCustomer ? ` (najczęściej ${p.topCustomer})` : "";
  return `${p.takenWhole} z ${p.deliveries} dostaw w ciągu ${ZD_ON_REQUEST_WINDOW_AFTER_DAYS} dni od faktury wziął w całości jeden klient${who} - to ${Math.round(p.salesShare * 100)}% sprzedaży.`;
}
