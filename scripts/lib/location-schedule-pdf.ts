import { readFileSync } from "fs";
import { parseInterval } from "../../src/lib/orders/dates";

export type LocationScheduleRow = {
  name: string;
  pickup_mikran: boolean;
  pickup_pallet: boolean;
  notes: string;
  extra_info: string;
  order_date: string | null;
  computed_next_date: string | null;
  shift_date: string | null;
  stock_raw: string;
  stock_weeks: number | null;
  vacation_note_raw: string;
};

const DATE_RE =
  /\b(\d{4}-\d{2}-\d{2}|\d{1,2}-\d{1,2}-\d{4})\b/g;

const METHODS = ["MAILOWO", "TELEFONICZNIE", "PRZEZ INTERNET", "INTERNETOWO"];

export function parseFlexibleDate(raw: string): string | null {
  const v = raw.trim();
  if (!v || /w razie potrzeby/i.test(v)) return null;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const pl = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (pl) {
    const d = pl[1].padStart(2, "0");
    const m = pl[2].padStart(2, "0");
    return `${pl[3]}-${m}-${d}`;
  }
  return null;
}

function isCheck(v: string): boolean {
  return /^[✔✓xX1]/.test(v.trim());
}

function parseStock(raw: string): { stock_raw: string; stock_weeks: number | null } {
  const v = raw.trim();
  if (!v) return { stock_raw: "", stock_weeks: null };
  if (/w razie potrzeby/i.test(v)) return { stock_raw: v, stock_weeks: null };
  const parsed = parseInterval(v);
  if (parsed?.unit === "weeks") return { stock_raw: v, stock_weeks: parsed.value };
  return { stock_raw: v, stock_weeks: null };
}

function extractDatesFromText(remainder: string): {
  order_date: string | null;
  computed_next_date: string | null;
  shift_date: string | null;
  stock_raw: string;
  vacation_note_raw: string;
  extra_info: string;
} {
  const asNeeded = /w razie potrzeby/i.test(remainder);
  const isoDates: string[] = [];
  for (const m of remainder.matchAll(DATE_RE)) {
    const iso = parseFlexibleDate(m[1]);
    if (iso) isoDates.push(iso);
  }

  const order_date: string | null = isoDates[0] ?? null;
  let computed_next_date: string | null = isoDates[1] ?? null;
  const shift_date: string | null = isoDates[2] ?? null;

  if (asNeeded && isoDates.length < 2) computed_next_date = null;

  let extra = remainder
    .replace(DATE_RE, " ")
    .replace(/w razie potrzeby/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  let stock_raw = "";
  const stockMatch = extra.match(
    /(\d+\s*miesi[aąęe]+|pó[łl]\s*roku|rok|\d{1,2}\s*tyg\.?|\b\d{1,2}\b)\s*$/i
  );
  if (stockMatch) {
    stock_raw = stockMatch[1].trim();
    extra = extra.slice(0, extra.length - stockMatch[0].length).trim();
  }

  return {
    order_date,
    computed_next_date,
    shift_date,
    stock_raw,
    vacation_note_raw: "",
    extra_info: extra,
  };
}

function rowFromParts(parts: string[]): LocationScheduleRow | null {
  const filtered = parts.map((p) => p.trim()).filter(Boolean);
  if (!filtered.length) return null;

  const name = filtered[0];
  if (!name || /^DOSTAWCA$/i.test(name)) return null;
  if (parseFlexibleDate(name) || /^w razie potrzeby$/i.test(name)) return null;
  if (/^KSEF:/i.test(name) || /^https?:\/\//i.test(name)) return null;
  if (/@/.test(name) || /^FORMULARZ\b/i.test(name) || /^DW\s/i.test(name)) return null;

  let idx = 1;
  const pickup_mikran = idx < filtered.length && isCheck(filtered[idx]);
  if (pickup_mikran) idx++;

  const pickup_pallet =
    idx < filtered.length &&
    (/zlec|odbiór|odbior/i.test(filtered[idx]) && isCheck(filtered[idx]) ||
      filtered[idx] === "✔");
  if (pickup_pallet && isCheck(filtered[idx])) idx++;

  let notes = "";
  if (idx < filtered.length && METHODS.some((m) => filtered[idx].toUpperCase().includes(m))) {
    if (filtered[idx].toUpperCase().includes("INTERNET")) notes = "PRZEZ INTERNET";
    else if (filtered[idx].toUpperCase().includes("TELEFON")) notes = "TELEFONICZNIE";
    else if (filtered[idx].toUpperCase().includes("MAIL")) notes = "MAILOWO";
    idx++;
  }

  const remainder = filtered.slice(idx).join(" ");
  const parsed = extractDatesFromText(remainder);
  const stock = parseStock(parsed.stock_raw);

  return {
    name,
    pickup_mikran,
    pickup_pallet,
    notes,
    extra_info: parsed.extra_info,
    order_date: parsed.order_date,
    computed_next_date: parsed.computed_next_date,
    shift_date: parsed.shift_date,
    stock_raw: stock.stock_raw,
    stock_weeks: stock.stock_weeks,
    vacation_note_raw: parsed.vacation_note_raw,
  };
}

function isSupplierHeaderLine(line: string): boolean {
  const parts = line.split("\t").map((p) => p.trim()).filter(Boolean);
  if (!parts.length || !isLikelySupplierName(parts[0])) return false;
  const tail = parts.slice(1).join(" ").toUpperCase();
  if (METHODS.some((m) => tail.includes(m))) return true;
  return parts.length >= 2 && isCheck(parts[1]);
}

function closeBrokenRows(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] ?? "";
    out.push(line);
    const lineHasDate = DATE_RE.test(line) || /w razie potrzeby/i.test(line);
    const nextFirst = next.split("\t")[0]?.trim() ?? "";
    const nextIsSupplier =
      /^\s*[^\t\n]/.test(next) &&
      /\t/.test(next) &&
      isLikelySupplierName(nextFirst) &&
      !/^(DOSTAWCA|MAILOWO|TELEFONICZNIE|PRZEZ|INTERNET|https?)/i.test(nextFirst);
    if (
      line.trim() &&
      nextIsSupplier &&
      !lineHasDate &&
      isSupplierHeaderLine(line)
    ) {
      out.push("\tW RAZIE POTRZEBY");
    }
  }
  return out.join("\n");
}

function isLikelySupplierName(cell: string): boolean {
  if (
    !cell ||
    /@/.test(cell) ||
    /^FORMULARZ\b/i.test(cell) ||
    /^DW\s/i.test(cell) ||
    /^(hasło|login|https?|http|DW:|tel\.|tel:|na zamówienie|zamawiają|AND\s)/i.test(cell)
  ) {
    return false;
  }
  return /^[A-Z0-9ĄĆĘŁŃÓŚŹŻ"(]/.test(cell) && cell.length >= 2;
}

function mergeMultilineRows(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const firstCell = t.split("\t")[0].trim();
    const hasTab = t.includes("\t");
    const looksLikeSupplierStart =
      hasTab &&
      /^[^\t]+\t/.test(t) &&
      !/^(hasło|login|https?|http|DW:|tel\.|tel:|na zamówienie)/i.test(firstCell);
    const prev = out[out.length - 1] ?? "";
    const prevComplete = !out.length || isCompleteLine(prev);
    const prevIsHeader = isSupplierHeaderLine(prev);
    const isNewRow =
      looksLikeSupplierStart &&
      isLikelySupplierName(firstCell) &&
      (prevComplete || prevIsHeader);

    if (!hasTab && out.length) {
      if (isCompleteLine(out[out.length - 1])) {
        out.push(t);
      } else {
        out[out.length - 1] += " " + t;
      }
    } else if (isNewRow) {
      out.push(t);
    } else if (out.length) {
      const prev = out[out.length - 1];
      const joiner =
        prev.endsWith("\t") || t.startsWith("\t")
          ? ""
          : !prev.includes("\t") && hasTab
            ? " "
            : "\t";
      out[out.length - 1] = prev + joiner + t;
    } else {
      out.push(t);
    }
  }
  return out.join("\n");
}

function isCompleteLine(line: string): boolean {
  DATE_RE.lastIndex = 0;
  return DATE_RE.test(line) || /\tW RAZIE POTRZEBY\s*$/i.test(line);
}

export function parseLocationScheduleText(text: string): LocationScheduleRow[] {
  const normalized = text
    .replace(/\r/g, "")
    .replace(/\t+/g, "\t")
    .replace(/^DOSTAWCA\t.*\n/gim, "")
    .replace(/^--\s*\d+\s+of\s+\d+\s*--\s*$/gim, "");
  const cleaned = closeBrokenRows(mergeMultilineRows(normalized));

  const rows: LocationScheduleRow[] = [];
  const lineRows = cleaned.split("\n").filter((l) => l.trim() && !/^DOSTAWCA/i.test(l));

  for (const line of lineRows) {
    const parts = line.replace(/\n/g, "").trim().split("\t");
    const row = rowFromParts(parts);
    if (row) rows.push(row);
  }

  const byName = new Map<string, LocationScheduleRow>();
  for (const r of rows) byName.set(r.name, r);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

export async function extractPdfText(pdfPath: string): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const chunks: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) line += "\n";
      else line += "\t";
    }
    chunks.push(line);
  }
  return chunks.join("\n");
}
