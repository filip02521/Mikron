/**
 * Parsuje arkusz POLSKA (PDF) → data/polska-schedules.json + CSV
 *
 * Kolumny: DOSTAWCA, KIEROWCA MIKRAN, ZLEC ODBIÓR, SPOSÓB, DODATKOWE,
 *          DATA ZAMÓWIENIA, DATA KOLEJNEGO, PRZESUNIĘCIE, ZAPAS, UWAGI URLOPOWE
 *
 * Użycie:
 *   npx tsx scripts/build-polska-from-pdf.ts [ścieżka-pdf]
 *   npx tsx scripts/build-polska-from-pdf.ts --from-raw
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { parseIntervalWeeks } from "../src/lib/orders/dates";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const defaultPdf =
  "/Users/Filip/Downloads/System Dostaw v.9 Synchronizacja DK z HI, Częściowa realizacja - POLSKA.pdf";

export type PolskaScheduleRow = {
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

function parseFlexibleDate(raw: string): string | null {
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
  const weeks = parseIntervalWeeks(v);
  if (weeks) return { stock_raw: v, stock_weeks: weeks };
  const n = Number(v);
  if (!isNaN(n) && n > 0) return { stock_raw: v, stock_weeks: Math.round(n) };
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

  // Kolejność jak w arkuszu: DATA ZAMÓWIENIA → DATA KOLEJNEGO → PRZESUNIĘCIE
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
    /(\d+\s*miesi[aą]ce?|pó[łl]\s*roku|rok|\d{1,2}\s*tyg\.?|\b\d{1,2}\b)\s*$/i
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

function rowFromParts(parts: string[]): PolskaScheduleRow | null {
  const filtered = parts.map((p) => p.trim()).filter(Boolean);
  if (!filtered.length) return null;

  const name = filtered[0];
  if (!name || /^DOSTAWCA$/i.test(name)) return null;
  if (parseFlexibleDate(name) || /^w razie potrzeby$/i.test(name)) return null;
  if (/^KSEF:/i.test(name) || /^https?:\/\//i.test(name)) return null;

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
    notes = filtered[idx].replace("INTERNETOWO", "PRZEZ INTERNET");
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
      !parseFlexibleDate(nextFirst) &&
      !/^(DOSTAWCA|MAILOWO|TELEFONICZNIE|PRZEZ|INTERNET|https?)/i.test(nextFirst);
    if (line.trim() && nextIsSupplier && !lineHasDate && !isCheck(line.split("\t")[1] ?? "")) {
      out.push("\tW RAZIE POTRZEBY");
    }
  }
  return out.join("\n");
}

function isLikelySupplierName(cell: string): boolean {
  if (!cell || /^(hasło|login|https?|http|DW:|tel\.|tel:|na zamówienie|zamawiają|AND\s)/i.test(cell)) {
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
    const prevComplete = !out.length || isCompletePolskaLine(out[out.length - 1]);
    const isNewRow =
      looksLikeSupplierStart && (prevComplete || isLikelySupplierName(firstCell));

    if (!hasTab && out.length) {
      if (isCompletePolskaLine(out[out.length - 1])) {
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

function isCompletePolskaLine(line: string): boolean {
  DATE_RE.lastIndex = 0;
  return DATE_RE.test(line) || /\tW RAZIE POTRZEBY\s*$/i.test(line);
}

function parseText(text: string): PolskaScheduleRow[] {
  const normalized = text
    .replace(/\r/g, "")
    .replace(/\t+/g, "\t")
    .replace(/^DOSTAWCA\t.*\n/gim, "")
    .replace(/^--\s*\d+\s+of\s+\d+\s*--\s*$/gim, "");
  const cleaned = closeBrokenRows(mergeMultilineRows(normalized));

  const rows: PolskaScheduleRow[] = [];
  const lineRows = cleaned.split("\n").filter((l) => l.trim() && !/^DOSTAWCA/i.test(l));

  for (const line of lineRows) {
    const flat = line.replace(/\n/g, "").trim();
    const parts = flat.split("\t");
    const row = rowFromParts(parts);
    if (row) rows.push(row);
  }

  const byName = new Map<string, PolskaScheduleRow>();
  for (const r of rows) byName.set(r.name, r);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

async function extractPdfText(pdfPath: string): Promise<string> {
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

async function main() {
  const fromRaw = process.argv.includes("--from-raw");
  const pdfPath =
    process.argv.find((a) => a.endsWith(".pdf")) || defaultPdf;
  const rawPath = join(root, "data", "polska.raw.txt");
  const dataDir = join(root, "data");
  mkdirSync(dataDir, { recursive: true });

  let text: string;
  if (fromRaw) {
    text = readFileSync(rawPath, "utf-8");
    console.log("Źródło: data/polska.raw.txt");
  } else {
    text = await extractPdfText(pdfPath);
    writeFileSync(rawPath, text, "utf-8");
    console.log("PDF:", pdfPath);
    console.log("Zapisano → data/polska.raw.txt");
  }

  const rows = parseText(text);
  writeFileSync(
    join(dataDir, "polska-schedules.json"),
    JSON.stringify(rows, null, 2),
    "utf-8"
  );

  const csvHeader =
    "DOSTAWCA,DATA ZAMÓWIENIA,DATA KOLEJNEGO,PRZESUNIĘCIE,ZAPAS,UWAGI URLOPOWE";
  const csvLines = rows.map(
    (r) =>
      `"${r.name.replace(/"/g, '""')}",${r.order_date ?? ""},${r.computed_next_date ?? "W RAZIE POTRZEBY"},${r.shift_date ?? ""},${r.stock_raw},${r.vacation_note_raw}"`
  );
  writeFileSync(
    join(dataDir, "polska-schedules.csv"),
    [csvHeader, ...csvLines].join("\n"),
    "utf-8"
  );

  const withDates = rows.filter((r) => r.order_date).length;
  const withNext = rows.filter((r) => r.computed_next_date).length;
  console.log(`Zapisano ${rows.length} dostawców POLSKA`);
  console.log(`  z datą zamówienia: ${withDates}, z datą kolejną: ${withNext}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
