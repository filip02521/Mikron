/**
 * Dziennik decyzji per linia (mig. 201): przy każdym „Utwórz ZD” z Kreatora — co silnik proponował
 * (jednostki ZD), co poszło na dokument, które linie zdjęto. Z niego: KPI korekty na wszystkich ZD
 * (nie tylko z propozycji automatu) i „pamięć korekt” per towar (`zdLineDecisionPattern`), z której
 * silnik uczy się Twojego rytmu. Reguły czyste, I/O osobno.
 */
import { query } from "@/lib/db/pool";

export type ZdLineDecisionInput = {
  twId: number;
  symbol?: string | null;
  nazwa?: string | null;
  /** Jednostki ZD z silnika (po opakowaniach); null = linia dopisana ręcznie (silnik nie proponował). */
  proposedUnits: number | null;
  finalUnits: number;
  reason?: string | null;
  /** Mnożnik pamięci korekt już zawarty w `proposedUnits` (null/1 = bez). */
  patternFactor?: number | null;
};

export type ZdLineDecisionRow = {
  twId: number;
  proposedUnits: number;
  finalUnits: number;
  reason: string | null;
  patternFactor: number | null;
  decidedAt: string;
  /** Cena netto za jednostkę ZD z kopii linii ZD (nocny harvest); null = jeszcze nieznana. */
  priceNet: number | null;
};

/** Powody, które nie są wzorcem na zapas (jednorazowa decyzja pod klienta / promocję). */
export const ZD_LINE_DECISION_ONE_OFF_REASONS = new Set(["klient", "promocja"]);
/** Pamięć korekt patrzy na tyle ostatnich decyzji towaru… */
export const ZD_LINE_PATTERN_WINDOW = 4;
/** …i wymaga tylu zgodnych, żeby zadziałać. */
export const ZD_LINE_PATTERN_MIN_AGREE = 3;
/** Ilość ponad / poniżej propozycji liczy się jako kierunek od tego stosunku. */
export const ZD_LINE_PATTERN_UP_RATIO = 1.5;
export const ZD_LINE_PATTERN_DOWN_RATIO = 0.67;
/** Mnożnik z pamięci korekt nigdy poza tym zakresem. */
export const ZD_LINE_PATTERN_FACTOR_MIN = 0.5;
export const ZD_LINE_PATTERN_FACTOR_MAX = 2;

export type ZdLineDecisionPattern = {
  kind: "up" | "down" | "drop";
  /** Mediana stosunku ZD / propozycja ze zgodnych decyzji (drop = 0). */
  factor: number;
  /** Ile decyzji zgodnych z kierunkiem na ile ostatnich. */
  agree: number;
  of: number;
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * Wzorzec z ostatnich decyzji towaru (najnowsze pierwsze): 3 z 4 w tę samą stronę = wzorzec.
 * Decyzje „klient” / „promocja” i bez propozycji silnika (dopisane ręcznie) nie liczą się.
 */
export function zdLineDecisionPattern(rows: readonly ZdLineDecisionRow[]): ZdLineDecisionPattern | null {
  const usable = rows
    .filter((r) => r.proposedUnits > 0 && !(r.reason && ZD_LINE_DECISION_ONE_OFF_REASONS.has(r.reason)))
    .slice(0, ZD_LINE_PATTERN_WINDOW);
  if (usable.length < ZD_LINE_PATTERN_MIN_AGREE) return null;
  // Stosunek do surowej propozycji silnika: propozycja z pamięcią korekt to cel × mnożnik, więc
  // zaakceptowanie dopasowanej ilości (final = proposed) znaczy „mnożnik był dobry”, nie „bez korekty”.
  const ratios = usable.map(
    (r) => (r.finalUnits / r.proposedUnits) * (r.patternFactor != null && r.patternFactor > 0 ? r.patternFactor : 1)
  );
  const ups = ratios.filter((x) => x >= ZD_LINE_PATTERN_UP_RATIO);
  const downs = ratios.filter((x) => x <= ZD_LINE_PATTERN_DOWN_RATIO);
  const clamp = (x: number) => Math.min(ZD_LINE_PATTERN_FACTOR_MAX, Math.max(ZD_LINE_PATTERN_FACTOR_MIN, x));
  if (ups.length >= ZD_LINE_PATTERN_MIN_AGREE) {
    return { kind: "up", factor: clamp(median(ups)), agree: ups.length, of: usable.length };
  }
  if (downs.length >= ZD_LINE_PATTERN_MIN_AGREE) {
    const dropped = downs.filter((x) => x === 0).length;
    if (dropped >= ZD_LINE_PATTERN_MIN_AGREE) return { kind: "drop", factor: 0, agree: dropped, of: usable.length };
    return { kind: "down", factor: clamp(median(downs.filter((x) => x > 0))), agree: downs.length, of: usable.length };
  }
  return null;
}

export type ZdLineDecisionCorrection = {
  /** % jednostek propozycji zmienionych (|ZD − propozycja| / propozycja), wartościowo gdy znane ceny. */
  pct: number | null;
  lines: number;
  changed: number;
  dropped: number;
  added: number;
  zdCount: number;
  /** Ile linii miało cenę (wartość liczona po cenach); 0 = liczone w jednostkach. */
  priced: number;
};

/** Korekta na wszystkich ZD z Kreatora w okresie — po wartości, gdy ceny z kopii ZD są znane, inaczej w jednostkach. */
export function zdLineDecisionCorrection(rows: readonly (ZdLineDecisionRow & { dokId: number })[]): ZdLineDecisionCorrection {
  const proposed = rows.filter((r) => r.proposedUnits > 0);
  const priced = proposed.filter((r) => r.priceNet != null && r.priceNet > 0);
  const base = priced.length === proposed.length && proposed.length > 0 ? priced : proposed;
  const w = (r: ZdLineDecisionRow) => (base === priced ? (r.priceNet as number) : 1);
  let changed = 0;
  let total = 0;
  for (const r of base) {
    total += r.proposedUnits * w(r);
    changed += Math.abs(r.finalUnits - r.proposedUnits) * w(r);
  }
  return {
    pct: total > 0 ? Math.round((changed / total) * 1000) / 10 : null,
    lines: proposed.length,
    changed: proposed.filter((r) => r.finalUnits !== r.proposedUnits).length,
    dropped: proposed.filter((r) => r.finalUnits === 0).length,
    added: rows.filter((r) => !(r.proposedUnits > 0) && r.finalUnits > 0).length,
    zdCount: new Set(rows.map((r) => r.dokId)).size,
    priced: base === priced ? priced.length : 0,
  };
}

export async function recordZdLineDecisions(input: {
  supplierId: string;
  proposalId?: string | null;
  dokId: number;
  dokNr?: string | null;
  decidedBy?: string | null;
  lines: readonly ZdLineDecisionInput[];
}): Promise<number> {
  const clip = (s: string | null | undefined) => (s == null ? null : String(s).slice(0, 200));
  const rows = input.lines
    .filter((l) => Math.trunc(l.twId) > 0 && (l.finalUnits > 0 || (l.proposedUnits ?? 0) > 0))
    .map((l) => ({ ...l, symbol: clip(l.symbol), nazwa: clip(l.nazwa), reason: clip(l.reason) }));
  if (!rows.length) return 0;
  const res = await query(
    `INSERT INTO zd_line_decisions
       (supplier_id, proposal_id, dok_id, dok_nr, subiekt_tw_id, tw_symbol, tw_nazwa, proposed_units, final_units, reason, decided_by, pattern_factor)
     SELECT $1, $2, $3, $4, t.tw, t.symbol, t.nazwa, t.proposed, t.final, NULLIF(t.reason, ''), $5, t.pattern
       FROM unnest($6::int[], $7::text[], $8::text[], $9::numeric[], $10::numeric[], $11::text[], $12::numeric[])
         AS t(tw, symbol, nazwa, proposed, final, reason, pattern)`,
    [
      input.supplierId,
      input.proposalId ?? null,
      Math.trunc(input.dokId),
      input.dokNr ?? null,
      input.decidedBy ?? null,
      rows.map((l) => Math.trunc(l.twId)),
      rows.map((l) => l.symbol ?? null),
      rows.map((l) => l.nazwa ?? null),
      rows.map((l) => Math.max(0, Number(l.proposedUnits) || 0)),
      rows.map((l) => Math.max(0, Number(l.finalUnits) || 0)),
      rows.map((l) => l.reason ?? ""),
      rows.map((l) => (l.patternFactor != null && l.patternFactor > 0 ? l.patternFactor : null)),
    ]
  );
  return res.rowCount ?? 0;
}

/** Decyzje dostawcy w okresie (KPI), z ceną jednostki z kopii linii ZD, gdy nocny harvest ją już ma. */
export async function loadZdLineDecisionsForPeriod(input: {
  supplierId: string;
  from: string;
  to: string;
}): Promise<Array<ZdLineDecisionRow & { dokId: number }>> {
  const res = await query<{
    dok_id: number;
    tw: number;
    proposed: string;
    final: string;
    reason: string | null;
    decided_at: string;
    price_net: string | null;
    pattern: string | null;
  }>(
    `SELECT d.dok_id, d.subiekt_tw_id AS tw, d.proposed_units::text AS proposed, d.final_units::text AS final,
            d.reason, d.decided_at, l.price_net::text AS price_net, d.pattern_factor::text AS pattern
       FROM zd_line_decisions d
       LEFT JOIN zd_purchase_lines l ON l.dok_id = d.dok_id AND l.subiekt_tw_id = d.subiekt_tw_id
      WHERE d.supplier_id = $1
        AND (d.decided_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN $2::date AND $3::date
      ORDER BY d.decided_at DESC`,
    [input.supplierId, input.from, input.to]
  );
  return res.rows.map((r) => ({
    dokId: Number(r.dok_id),
    twId: Number(r.tw),
    proposedUnits: Number(r.proposed) || 0,
    finalUnits: Number(r.final) || 0,
    reason: r.reason,
    decidedAt: new Date(r.decided_at).toISOString(),
    priceNet: r.price_net == null ? null : Number(r.price_net),
    patternFactor: r.pattern == null ? null : Number(r.pattern),
  }));
}

/** Pamięć korekt: wzorzec per towar z ostatnich decyzji u tego dostawcy. */
export async function loadZdLineDecisionPatterns(input: {
  supplierId: string;
  twIds: readonly number[];
}): Promise<Map<number, ZdLineDecisionPattern>> {
  const ids = [...new Set(input.twIds.map((x) => Math.trunc(Number(x) || 0)).filter((x) => x > 0))];
  const out = new Map<number, ZdLineDecisionPattern>();
  if (!ids.length) return out;
  const res = await query<{
    tw: number;
    proposed: string;
    final: string;
    reason: string | null;
    decided_at: string;
    pattern: string | null;
  }>(
    `SELECT tw, proposed, final, reason, decided_at, pattern FROM (
       SELECT d.subiekt_tw_id AS tw, d.proposed_units::text AS proposed, d.final_units::text AS final, d.reason, d.decided_at,
              d.pattern_factor::text AS pattern,
              row_number() OVER (PARTITION BY d.subiekt_tw_id ORDER BY d.decided_at DESC, d.id DESC) AS rn
         FROM zd_line_decisions d
        WHERE d.supplier_id = $1 AND d.subiekt_tw_id = ANY($2::int[]) AND d.proposed_units > 0
     ) t WHERE rn <= $3
     ORDER BY tw, rn`,
    [input.supplierId, ids, ZD_LINE_PATTERN_WINDOW * 2]
  );
  const byTw = new Map<number, ZdLineDecisionRow[]>();
  for (const r of res.rows) {
    const tw = Number(r.tw);
    byTw.set(tw, [
      ...(byTw.get(tw) ?? []),
      {
        twId: tw,
        proposedUnits: Number(r.proposed) || 0,
        finalUnits: Number(r.final) || 0,
        reason: r.reason,
        decidedAt: new Date(r.decided_at).toISOString(),
        priceNet: null,
        patternFactor: r.pattern == null ? null : Number(r.pattern),
      },
    ]);
  }
  for (const [tw, rows] of byTw) {
    const p = zdLineDecisionPattern(rows);
    if (p) out.set(tw, p);
  }
  return out;
}
