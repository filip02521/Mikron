/**
 * Ruch towaru w karcie produktu: zamówienia (ZD), przyjęcia (FZ) i sprzedaż (FS/PA/WZ/ZW) w jednej
 * osi czasu, najnowsze pierwsze. Przyjęcie, które w oknie wziął w całości jeden klient, dostaje
 * dopisek „→ w N dni wziął X”, a jego sprzedaże — „z dostawy FZ …”: tak widać gołym okiem, że
 * 1 szt przyszła i po trzech dniach zeszła do jednego klienta, czyli zakup pod prośbę.
 * Progi okna i udziału te same co w wykrywaniu „na prośbę” (`zd-on-request-detect.ts`). Czyste funkcje.
 */
import {
  ZD_ON_REQUEST_TAKE_SHARE,
  ZD_ON_REQUEST_WINDOW_AFTER_DAYS,
  ZD_ON_REQUEST_WINDOW_BEFORE_DAYS,
} from "@/lib/orders/zd-on-request-detect";

export type ZdMovementDelivery = {
  /** Data przyjęcia (FZ) albo przybliżona (ZD + kilka dni). */
  date: string;
  pieces: number;
  dokNr: string | null;
  fzNr: string | null;
  /** Data ZD; null = ZD spoza historii. */
  zdDate: string | null;
  /** ZD bez faktury i jeszcze w drodze (nie liczy się jako przyjęcie). */
  inTransit?: boolean;
};

export type ZdMovementSale = {
  date: string;
  dokNr: string;
  khKey: string;
  khName: string | null;
  /** Sztuki; zwrot ujemny. */
  pieces: number;
  rola: "fs" | "pa" | "wzNiepowiazane" | "zw";
};

export type ZdMovementEvent =
  | {
      kind: "zd";
      date: string;
      dokNr: string | null;
      pieces: number;
      /** Dni od poprzedniego ZD; null = pierwsze w historii. */
      gapDays: number | null;
      inTransit: boolean;
    }
  | {
      kind: "in";
      date: string;
      dokNr: string | null;
      fzNr: string | null;
      pieces: number;
      /** Jeden klient wziął ≥ 80 % dostawy w oknie. */
      takenBy: { name: string; pieces: number; days: number } | null;
      group: number;
    }
  | {
      kind: "out";
      date: string;
      dokNr: string;
      rola: ZdMovementSale["rola"];
      pieces: number;
      khName: string | null;
      /** Należy do przyjęcia, które ten klient wziął w całości: ile dni po przyjęciu. */
      fromDelivery: { fzNr: string | null; dokNr: string | null; days: number } | null;
      group: number | null;
    };

export type ZdProductMovement = {
  events: ZdMovementEvent[];
  deliveries: number;
  takenWhole: number;
  /** Odstępy między ZD (dni), od najstarszego. */
  gaps: number[];
  /** Mediana odstępu i rozrzut: nieregularnie, gdy najdłuższy ≥ 2× najkrótszego przy ≥ 3 odstępach. */
  gapMedian: number | null;
  irregular: boolean;
};

const dayNum = (key: string) => Date.parse(`${key.slice(0, 10)}T00:00:00Z`) / 86_400_000;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function buildZdProductMovement(
  deliveries: readonly ZdMovementDelivery[],
  sales: readonly ZdMovementSale[],
  /** Początek osi (YYYY-MM-DD, włącznie): ZD i przyjęcia od tej daty; sprzedaż sprzed niej nadal dopasowuje dostawy, ale nie trafia na oś. */
  from: string | null = null
): ZdProductMovement {
  const events: ZdMovementEvent[] = [];
  const inRange = (d: ZdMovementDelivery) => !from || d.date >= from || (d.zdDate ?? "") >= from;
  const arrived = deliveries.filter((d) => !d.inTransit && d.date && d.pieces > 0 && inRange(d));
  const sold = sales.filter((s) => s.date);
  const saleGroup = new Map<ZdMovementSale, { group: number; days: number; fzNr: string | null; dokNr: string | null }>();
  let takenWhole = 0;
  // Najstarsze przyjęcie pierwsze: sprzedaż przypisana do pierwszej dostawy, którą klient wziął w całości.
  const byDate = [...arrived].sort((a, b) => a.date.localeCompare(b.date));
  byDate.forEach((d, group) => {
    const at = dayNum(d.date);
    const inWindow = sold.filter((s) => {
      const sd = dayNum(s.date);
      return s.pieces > 0 && !saleGroup.has(s) && sd >= at - ZD_ON_REQUEST_WINDOW_BEFORE_DAYS && sd <= at + ZD_ON_REQUEST_WINDOW_AFTER_DAYS;
    });
    const byKh = new Map<string, { pieces: number; name: string | null; rows: ZdMovementSale[] }>();
    for (const s of inWindow) {
      const cur = byKh.get(s.khKey) ?? { pieces: 0, name: s.khName, rows: [] };
      cur.pieces += s.pieces;
      cur.rows.push(s);
      byKh.set(s.khKey, cur);
    }
    let top: { pieces: number; name: string | null; rows: ZdMovementSale[] } | null = null;
    for (const v of byKh.values()) if (!top || v.pieces > top.pieces) top = v;
    let takenBy: Extract<ZdMovementEvent, { kind: "in" }>["takenBy"] = null;
    if (top && top.pieces >= ZD_ON_REQUEST_TAKE_SHARE * d.pieces) {
      const first = [...top.rows].sort((a, b) => a.date.localeCompare(b.date))[0]!;
      takenBy = { name: top.name?.trim() || "klient", pieces: top.pieces, days: Math.round(dayNum(first.date) - at) };
      takenWhole++;
      for (const s of top.rows) {
        saleGroup.set(s, { group, days: Math.round(dayNum(s.date) - at), fzNr: d.fzNr, dokNr: d.dokNr });
      }
    }
    events.push({ kind: "in", date: d.date, dokNr: d.dokNr, fzNr: d.fzNr, pieces: d.pieces, takenBy, group });
  });
  for (const s of sold) {
    if (from && s.date < from) continue;
    const g = saleGroup.get(s);
    events.push({
      kind: "out",
      date: s.date,
      dokNr: s.dokNr,
      rola: s.rola,
      pieces: s.pieces,
      khName: s.khName?.trim() || null,
      fromDelivery: g ? { fzNr: g.fzNr, dokNr: g.dokNr, days: g.days } : null,
      group: g?.group ?? null,
    });
  }
  const zdDates = deliveries
    .filter((d) => d.zdDate && inRange(d))
    .map((d) => ({ ...d, zdDate: d.zdDate as string }))
    .sort((a, b) => a.zdDate.localeCompare(b.zdDate));
  const gaps: number[] = [];
  zdDates.forEach((d, i) => {
    const gap = i > 0 ? Math.round(dayNum(d.zdDate) - dayNum(zdDates[i - 1]!.zdDate)) : null;
    if (gap != null) gaps.push(gap);
    events.push({ kind: "zd", date: d.zdDate, dokNr: d.dokNr, pieces: d.pieces, gapDays: gap, inTransit: d.inTransit === true });
  });
  // Najnowsze pierwsze; tego samego dnia: sprzedaż nad przyjęciem nad zamówieniem (czyta się jak dziennik).
  const order = { out: 0, in: 1, zd: 2 } as const;
  events.sort((a, b) => b.date.localeCompare(a.date) || order[a.kind] - order[b.kind]);
  const gapMedian = median(gaps);
  const irregular = gaps.length >= 3 && Math.max(...gaps) >= 2 * Math.max(1, Math.min(...gaps));
  return { events, deliveries: arrived.length, takenWhole, gaps, gapMedian, irregular };
}

/** Zdanie nad osią: „5 z 6 dostaw wziął w całości jeden klient · ZD co ~37 dni, nieregularnie (14–90)”. */
export function formatZdProductMovementSummary(m: ZdProductMovement): string | null {
  const parts: string[] = [];
  if (m.deliveries > 0) parts.push(`${m.takenWhole} z ${m.deliveries} dostaw wziął w całości jeden klient`);
  if (m.gapMedian != null && m.gaps.length >= 2) {
    const range = `${Math.min(...m.gaps)}–${Math.max(...m.gaps)}`;
    parts.push(`ZD co ~${Math.round(m.gapMedian)} dni${m.irregular ? `, nieregularnie (${range})` : ""}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

export type ZdMovementRange = "window" | "3m" | "12m" | "all";

/** Najkrótszy zakres osi — okno zapasu krótsze niż miesiąc i tak pokazuje miesiąc. */
export const ZD_MOVEMENT_MIN_DAYS = 30;

/**
 * Początek zakresu osi (YYYY-MM-DD, włącznie): „window” = okno sprzedaży, z którego liczony jest zapas,
 * nie krócej niż 30 dni; „3m” / „12m” od dziś; „all” = bez ograniczenia (null).
 */
export function zdMovementRangeFrom(
  range: ZdMovementRange,
  salesWindow: { dataOd: string; dataDo: string } | null | undefined,
  todayKey: string
): string | null {
  const shift = (key: string, days: number) =>
    new Date(Date.parse(`${key.slice(0, 10)}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  if (range === "all") return null;
  if (range === "3m") return shift(todayKey, 90);
  if (range === "12m") return shift(todayKey, 365);
  const minFrom = shift(salesWindow?.dataDo?.slice(0, 10) || todayKey, ZD_MOVEMENT_MIN_DAYS - 1);
  const from = salesWindow?.dataOd?.slice(0, 10);
  return from && from < minFrom ? from : minFrom;
}

/** Etykieta zakresu „window”: „okno zapasu (30 d)” albo „ostatni miesiąc”, gdy okno jest krótsze. */
export function zdMovementWindowLabel(salesWindow: { dataOd: string; dataDo: string } | null | undefined): string {
  if (!salesWindow?.dataOd || !salesWindow?.dataDo) return "ostatni miesiąc";
  const days = Math.round((Date.parse(salesWindow.dataDo.slice(0, 10)) - Date.parse(salesWindow.dataOd.slice(0, 10))) / 86_400_000) + 1;
  return days >= ZD_MOVEMENT_MIN_DAYS ? `okno zapasu (${days} d)` : "ostatni miesiąc";
}
