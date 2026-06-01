import { parseInterval } from "../../src/lib/orders/dates";
import { parseFlexibleDate, type LocationScheduleRow } from "./location-schedule-pdf";
import {
  SHEET_SCHEDULE_COL,
  SHEET_SCHEDULE_HEADER_ALIASES,
} from "./sheet-schedule-columns";

function headerMap(headers: string[]): Map<string, number> {
  const m = new Map<string, number>();
  headers.forEach((h, i) => m.set(h.toUpperCase().trim(), i));
  return m;
}

function colByHeader(
  map: Map<string, number>,
  row: string[],
  aliases: readonly string[],
  fallbackIndex: number
): string {
  for (const n of aliases) {
    const i = map.get(n.toUpperCase());
    if (i !== undefined && row[i] !== undefined) return row[i].trim();
  }
  return row[fallbackIndex]?.trim() ?? "";
}

function isCheck(v: string): boolean {
  return /^[✔✓xX1]/i.test(v.trim());
}

function parseOnDemand(raw: string): boolean {
  return /w razie potrzeby/i.test(raw.trim());
}

function normalizeSupplierSheetName(name: string): string {
  return name.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Jedna linia arkusza → pola harmonogramu zgodne z Sheets:
 * - order_date ← F (DATA ZAMÓWIENIA)
 * - computed_next_date ← G (DATA KOLEJNEGO), nigdy nie zastępowane przez H
 * - shift_date ← H (PRZESUNIĘCIE), tylko gdy komórka ma datę
 */
export function parseSheetScheduleRow(
  headers: string[],
  cells: string[]
): LocationScheduleRow | null {
  const map = headerMap(headers);
  const name = normalizeSupplierSheetName(
    colByHeader(map, cells, ["DOSTAWCA"], SHEET_SCHEDULE_COL.DOSTAWCA)
  );
  if (!name || /^DOSTAWCA$/i.test(name)) return null;
  if (parseFlexibleDate(name)) return null;

  const orderRaw = colByHeader(
    map,
    cells,
    SHEET_SCHEDULE_HEADER_ALIASES.DATA_ZAMOWIENIA,
    SHEET_SCHEDULE_COL.DATA_ZAMOWIENIA
  );
  const nextRaw = colByHeader(
    map,
    cells,
    SHEET_SCHEDULE_HEADER_ALIASES.DATA_KOLEJNEGO,
    SHEET_SCHEDULE_COL.DATA_KOLEJNEGO
  );
  const shiftRaw = colByHeader(
    map,
    cells,
    SHEET_SCHEDULE_HEADER_ALIASES.PRZESUNIECIE,
    SHEET_SCHEDULE_COL.PRZESUNIECIE
  );

  const order_date = parseFlexibleDate(orderRaw);
  const shift_date = shiftRaw && !parseOnDemand(shiftRaw) ? parseFlexibleDate(shiftRaw) : null;
  let computed_next_date: string | null = null;
  if (nextRaw && !parseOnDemand(nextRaw)) {
    computed_next_date = parseFlexibleDate(nextRaw);
  }
  if (!computed_next_date && shift_date) {
    computed_next_date = shift_date;
  }

  const stock_raw = colByHeader(map, cells, ["ZAPAS"], SHEET_SCHEDULE_COL.ZAPAS);
  let stock_weeks: number | null = null;
  const stockV = stock_raw.trim();
  if (stockV && !parseOnDemand(stockV)) {
    const parsed = parseInterval(stockV);
    if (parsed?.unit === "weeks") stock_weeks = parsed.value;
  }

  let notes = colByHeader(map, cells, ["SPOSÓB", "SPOSOB"], SHEET_SCHEDULE_COL.SPOSOB);
  if (/INTERNET/i.test(notes)) notes = "PRZEZ INTERNET";
  else if (/TELEFON/i.test(notes)) notes = "TELEFONICZNIE";
  else if (/MAIL/i.test(notes)) notes = "MAILOWO";

  return {
    name,
    pickup_mikran: isCheck(
      colByHeader(map, cells, ["KIEROWCA MIKRAN"], SHEET_SCHEDULE_COL.KIEROWCA_MIKRAN)
    ),
    pickup_pallet: isCheck(
      colByHeader(map, cells, ["ZLEC ODBIÓR", "ZLEC ODBIOR"], SHEET_SCHEDULE_COL.ZLEC_ODBIOR)
    ),
    notes,
    extra_info: colByHeader(map, cells, ["DODATKOWE"], SHEET_SCHEDULE_COL.DODATKOWE),
    order_date,
    computed_next_date,
    shift_date,
    stock_raw,
    stock_weeks,
    vacation_note_raw: colByHeader(
      map,
      cells,
      ["UWAGI URLOPOWE", "URLOP"],
      SHEET_SCHEDULE_COL.UWAGI_URLOPOWE
    ),
  };
}
