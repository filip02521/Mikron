/** Walidacja zgłoszenia braku części serwisowej (czysta logika, bez DB). */

export const SERVICE_PART_REPORT_MAX_QTY = 9999;
export const SERVICE_PART_REPORT_NOTE_MAX = 200;
export const SERVICE_SALES_GROUP_NAME = "Serwis";

export type ServicePartReportInput = { twId: number; quantity: number; note?: string | null };

export type ServicePartReportParsed =
  | { ok: true; twId: number; quantity: number; note: string }
  | { ok: false; message: string };

export function parseServicePartReport(input: ServicePartReportInput): ServicePartReportParsed {
  const twId = Math.trunc(Number(input.twId));
  if (!Number.isSafeInteger(twId) || twId <= 0) {
    return { ok: false, message: "Nieprawidłowy towar. Odśwież listę części." };
  }
  const qty = Number(input.quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    return { ok: false, message: "Wpisz ilość jako liczbę całkowitą większą od zera." };
  }
  if (qty > SERVICE_PART_REPORT_MAX_QTY) {
    return { ok: false, message: `Ilość może wynosić najwyżej ${SERVICE_PART_REPORT_MAX_QTY} szt.` };
  }
  const note = String(input.note ?? "").trim().slice(0, SERVICE_PART_REPORT_NOTE_MAX);
  return { ok: true, twId, quantity: qty, note };
}

/** Treść uwagi prośby: zakupy od razu widzą, że to serwis, i do czego część jest potrzebna. */
export function servicePartRequestNote(note: string): string {
  return note ? `Zgłoszenie serwisu: ${note}` : "Zgłoszenie serwisu";
}
