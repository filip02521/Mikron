/**
 * Wejścia bezpieczników propozycji ZD (zadanie 4, `zd-proposal-guards.ts`) — tylko odczyt.
 * Historia ZD: `zd_purchase_lines` (mig. 189, karta produktu „historia zakupów”) przypisana
 * do dostawcy przez `subiekt_zd_index.supplier_id`. Profil: `zd_sales_profiles`.
 * Sprzedaż dokument po dokumencie: GET Subiekta (ten sam odczyt co karta produktu w Kreatorze).
 */
import { query } from "@/lib/db/pool";
import { fetchSubiektProductSalesDocs } from "@/lib/subiekt/api";

export type ZdGuardSaleDoc = { dokId: number; qty: number };

export type ZdProposalGuardInputs = {
  /** Jednostki ZD z ostatnich ZD towaru u dostawcy, najnowsze pierwsze (≤ zdPerTw). */
  recentZdUnitsByTw: Map<number, number[]>;
  /** Wartości netto ostatnich ZD dostawcy, najnowsze pierwsze (≤ supplierZd). */
  recentOrderValues: number[];
  /** Profil 12 × 30 d (najnowszy policzony), od najstarszego okna. */
  profileWindowsByTw: Map<number, number[]>;
};

export async function loadZdProposalGuardInputs(input: {
  supplierId: string;
  twIds: readonly number[];
  /** Ile ostatnich ZD na towar i ile ostatnich ZD dostawcy (progi w zd-proposal-guards.ts). */
  zdPerTw: number;
  supplierZd: number;
}): Promise<ZdProposalGuardInputs> {
  const ids = [...new Set(input.twIds.map((x) => Math.trunc(x)).filter((x) => x > 0))];
  const [history, orders, profiles] = await Promise.all([
    query<{ tw: number; qty: string }>(
      `SELECT tw, qty FROM (
         SELECT l.subiekt_tw_id AS tw, l.qty,
                row_number() OVER (PARTITION BY l.subiekt_tw_id ORDER BY l.dok_date DESC NULLS LAST, l.dok_id DESC) AS rn
           FROM zd_purchase_lines l
           JOIN subiekt_zd_index i ON i.dok_id = l.dok_id
          WHERE i.supplier_id = $1 AND l.subiekt_tw_id = ANY($2::int[]) AND l.qty > 0
       ) t WHERE rn <= $3
       ORDER BY tw, rn`,
      [input.supplierId, ids, input.zdPerTw]
    ),
    query<{ value: string }>(
      `SELECT SUM(l.qty * l.price_net) AS value
         FROM subiekt_zd_index i
         JOIN zd_purchase_lines l ON l.dok_id = i.dok_id
        WHERE i.supplier_id = $1
        GROUP BY i.dok_id
       HAVING SUM(l.qty * l.price_net) > 0
        ORDER BY MAX(l.dok_date) DESC NULLS LAST, i.dok_id DESC
        LIMIT $2`,
      [input.supplierId, input.supplierZd]
    ),
    query<{ tw: number; windows: unknown }>(
      `SELECT DISTINCT ON (subiekt_tw_id) subiekt_tw_id AS tw, windows
         FROM zd_sales_profiles
        WHERE subiekt_tw_id = ANY($1::int[])
        ORDER BY subiekt_tw_id, end_date DESC, computed_at DESC`,
      [ids]
    ),
  ]);
  const recentZdUnitsByTw = new Map<number, number[]>();
  for (const r of history.rows) {
    const list = recentZdUnitsByTw.get(Number(r.tw)) ?? [];
    list.push(Number(r.qty));
    recentZdUnitsByTw.set(Number(r.tw), list);
  }
  const profileWindowsByTw = new Map<number, number[]>();
  for (const r of profiles.rows) {
    if (Array.isArray(r.windows)) profileWindowsByTw.set(Number(r.tw), r.windows.map((v) => Number(v) || 0));
  }
  return {
    recentZdUnitsByTw,
    recentOrderValues: orders.rows.map((r) => Number(r.value)).filter((v) => Number.isFinite(v)),
    profileWindowsByTw,
  };
}

/** Dokumenty sprzedaży towaru w oknie (FS, PA, WZ niepowiązane; ZW ujemne). Niepełna lista = błąd. */
export async function fetchZdGuardPeakDocs(input: {
  towarId: number;
  dataOd: string;
  dataDo: string;
}): Promise<ZdGuardSaleDoc[]> {
  const { rows, truncated } = await fetchSubiektProductSalesDocs(input);
  if (truncated) throw new Error("Lista dokumentów sprzedaży niepełna (limit stron).");
  return rows.map((r) => ({ dokId: r.dokId, qty: r.qty }));
}
