/**
 * Przesyłka do odprawy: etap i terminy (składowanie na terminalu, zwrot do nadawcy, należności).
 * Etap wynika z wpisanych dat — nie ma ręcznego wyboru, który mógłby się rozjechać z faktami.
 * Czysta logika — bez bazy i sieci; daty jako „YYYY-MM-DD”.
 */

export type CustomsShipment = {
  forwarder: string;
  transportRef: string;
  eta: string | null;
  /** Dzień przyjęcia na terminal / magazyn agencji (od niego liczy się wolne składowanie). */
  arrivedAt: string | null;
  /** Dni bez opłat za składowanie, licząc dzień przybycia (DHL Express: 3). */
  freeStorageDays: number;
  dutiesAmount: number | null;
  dutiesPaidAt: string | null;
  /** Numer zgłoszenia z ZC429 — po nim odprawa jest zakończona. */
  mrn: string;
  deliveredAt: string | null;
};

export const EMPTY_SHIPMENT: CustomsShipment = {
  forwarder: "",
  transportRef: "",
  eta: null,
  arrivedAt: null,
  freeStorageDays: 3,
  dutiesAmount: null,
  dutiesPaidAt: null,
  mrn: "",
  deliveredAt: null,
};

/** DHL Express: brak dokumentów przez 10 dni od przybycia = zwrot do nadawcy. */
export const RETURN_AFTER_DAYS = 10;

export type ShipmentStage = "none" | "in_transit" | "at_terminal" | "duties_due" | "cleared" | "delivered";

export const SHIPMENT_STAGE_LABEL: Record<ShipmentStage, string> = {
  none: "Bez danych przesyłki",
  in_transit: "W drodze",
  at_terminal: "Na terminalu",
  duties_due: "Należności do zapłaty",
  cleared: "Odprawiona",
  delivered: "Dostarczona",
};

export function shipmentStage(s: CustomsShipment): ShipmentStage {
  if (s.deliveredAt) return "delivered";
  if (s.mrn.trim()) return "cleared";
  if (s.dutiesAmount != null && s.dutiesAmount > 0 && !s.dutiesPaidAt) return "duties_due";
  if (s.arrivedAt) return "at_terminal";
  if (s.eta || s.transportRef.trim() || s.forwarder.trim()) return "in_transit";
  return "none";
}

function toDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86_400_000;
}

function fromDay(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromDay(toDay(iso) + days);
}

/** Ostatni dzień bez opłat za składowanie (dzień przybycia się wlicza). */
export function lastFreeStorageDay(s: CustomsShipment): string | null {
  return s.arrivedAt ? addDays(s.arrivedAt, Math.max(1, s.freeStorageDays) - 1) : null;
}

export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

export type ShipmentAlert = {
  tone: "danger" | "warning" | "info";
  text: string;
  /** Im mniejszy, tym wyżej na liście (dni do terminu; pilne ujemne). */
  urgency: number;
};

/**
 * Najpilniejsze rzeczy do zrobienia przy przesyłce na dziś.
 * `documentsSent` — mail z danymi do odprawy wysłany do agencji (status odprawy „sent”).
 */
export function shipmentAlerts(s: CustomsShipment, documentsSent: boolean, today: string): ShipmentAlert[] {
  const stage = shipmentStage(s);
  const out: ShipmentAlert[] = [];
  const t = toDay(today);

  if (stage === "at_terminal" || stage === "duties_due") {
    const free = lastFreeStorageDay(s)!;
    const left = toDay(free) - t;
    if (left < 0) {
      out.push({ tone: "danger", text: `Składowe naliczane od ${formatShortDate(addDays(free, 1))}`, urgency: left });
    } else if (left === 0) {
      out.push({ tone: "danger", text: "Składowe od jutra - dziś ostatni dzień bez opłat", urgency: 0 });
    } else {
      out.push({
        tone: left === 1 ? "warning" : "info",
        text: left === 1 ? "Jutro ostatni dzień bez składowego" : `Bez składowego do ${formatShortDate(free)}`,
        urgency: left,
      });
    }
    if (!documentsSent) {
      const returnDay = addDays(s.arrivedAt!, RETURN_AFTER_DAYS);
      const toReturn = toDay(returnDay) - t;
      out.push({
        tone: toReturn <= 3 ? "danger" : "warning",
        text:
          toReturn <= 3
            ? `Dokumenty nie wysłane - zwrot do nadawcy ${formatShortDate(returnDay)}`
            : "Dokumenty do odprawy nie wysłane do agencji",
        urgency: Math.min(left, toReturn) - 0.5,
      });
    }
  }

  if (stage === "duties_due") {
    out.push({ tone: "warning", text: "Należności do zapłaty - przekaż Darii", urgency: -0.1 });
  }

  if (stage === "in_transit" && s.eta) {
    const toEta = toDay(s.eta) - t;
    out.push(
      toEta < 0
        ? { tone: "warning", text: `ETA ${formatShortDate(s.eta)} minęło - sprawdź status u spedytora`, urgency: 2 }
        : { tone: "info", text: `ETA ${formatShortDate(s.eta)}`, urgency: 10 + toEta }
    );
  }

  return out.sort((a, b) => a.urgency - b.urgency);
}

/** Kolumny przesyłki w `customs_clearances` (migracja 171) — przed migracją ich brak, wtedy wartości puste. */
export type CustomsShipmentRow = {
  forwarder?: string | null;
  transport_ref?: string | null;
  eta?: string | null;
  arrived_at?: string | null;
  free_storage_days?: number | null;
  duties_amount?: number | string | null;
  duties_paid_at?: string | null;
  mrn?: string | null;
  delivered_at?: string | null;
};

export function shipmentFromRow(row: CustomsShipmentRow): CustomsShipment {
  const duties = row.duties_amount == null || row.duties_amount === "" ? null : Number(row.duties_amount);
  return {
    forwarder: row.forwarder ?? "",
    transportRef: row.transport_ref ?? "",
    eta: row.eta ?? null,
    arrivedAt: row.arrived_at ?? null,
    freeStorageDays: row.free_storage_days ?? EMPTY_SHIPMENT.freeStorageDays,
    dutiesAmount: duties != null && Number.isFinite(duties) ? duties : null,
    dutiesPaidAt: row.duties_paid_at ?? null,
    mrn: row.mrn ?? "",
    deliveredAt: row.delivered_at ?? null,
  };
}

/** Dzisiejsza data w Polsce jako „YYYY-MM-DD” (terminy agencji liczone są w dniach kalendarzowych). */
export function todayInWarsaw(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(now);
}
