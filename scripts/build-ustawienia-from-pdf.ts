/**
 * Parsuje arkusz USTAWIENIA (PDF) → data/ustawienia.csv + data/ustawienia.json
 *
 * Użycie:
 *   npx tsx scripts/build-ustawienia-from-pdf.ts [ścieżka-do-pdf]
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { intervalWeeksForStorage, parseInterval } from "../src/lib/orders/dates";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const defaultPdf =
  "/Users/Filip/Downloads/System Dostaw v.9 Synchronizacja DK z HI, Częściowa realizacja - USTAWIENIA.pdf";

export type UstawieniaRow = {
  name: string;
  location: "POLSKA" | "ZAGRANICA" | "IMPORT";
  pickup_raw: string;
  pickup_mikran: boolean;
  pickup_pallet: boolean;
  notes: string;
  mails: string;
  extra_info: string;
  stock_raw: string;
  stock_weeks: number | null;
  interval_raw: string;
  interval_weeks: number | null;
  stats_mode: "LACZNIE" | "OSOBNO";
};

function parseStockWeeks(raw: string): number | null {
  const v = raw.trim();
  if (!v || /w razie potrzeby/i.test(v)) return null;
  const parsed = parseInterval(v);
  return intervalWeeksForStorage(v, parsed);
}

function parsePickup(pickup: string) {
  const u = pickup.toUpperCase();
  return {
    pickup_raw: pickup,
    pickup_mikran: u.includes("KIEROWCA MIKRAN"),
    pickup_pallet: u.includes("ZLECAMY ODBIÓR") || u.includes("ZLECAMY ODBIOR"),
  };
}

function parseStats(raw: string): "LACZNIE" | "OSOBNO" {
  return raw.toUpperCase().includes("OSOBNO") ? "OSOBNO" : "LACZNIE";
}

function isIntervalLike(v: string): boolean {
  const t = v.trim();
  if (!t || /w razie potrzeby/i.test(t)) return false;
  if (parseInterval(t)) return true;
  return /^\d{1,3}$/.test(t);
}

function isStockLike(v: string): boolean {
  const t = v.trim();
  if (!t) return false;
  if (/w razie potrzeby/i.test(t)) return true;
  if (parseInterval(t)) return true;
  return /rok|miesi|tyg|pó[łl]\s*roku|kwartal/i.test(t);
}

function splitStockInterval(filtered: string[], locIdx: number): {
  stockRaw: string;
  intervalRaw: string;
  tailStart: number;
} {
  if (filtered.length < locIdx + 5) {
    return { stockRaw: "", intervalRaw: "", tailStart: filtered.length };
  }

  // Arkusz: przedostatnie = ZAPAS (G), ostatnie = INTERWAL (H)
  let intervalRaw = filtered[filtered.length - 1] ?? "";
  let stockRaw = filtered[filtered.length - 2] ?? "";
  let tailStart = filtered.length - 2;

  if (/w razie potrzeby/i.test(intervalRaw)) {
    const maybeInterval = stockRaw;
    stockRaw = intervalRaw;
    intervalRaw =
      isIntervalLike(maybeInterval) && !/w razie potrzeby/i.test(maybeInterval)
        ? maybeInterval
        : "";
    tailStart = filtered.length - (intervalRaw ? 2 : 1);
  }

  return { stockRaw, intervalRaw, tailStart };
}

/** Łączy wiersze kontynuacji (URL, login) z poprzednim dostawcą przed ŁĄCZNIE. */
function mergeMultilineUstawieniaRows(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const hasLoc = /\t\s*(POLSKA|ZAGRANICA|IMPORT)\s*\t/i.test(t);
    const prev = out[out.length - 1] ?? "";
    const prevDone = /\t(ŁĄCZNIE|LACZNIE|OSOBNO)\s*$/i.test(prev);
    if (hasLoc && (!out.length || prevDone)) {
      out.push(t);
    } else if (out.length && !prevDone) {
      out[out.length - 1] += (t.includes("\t") ? "\t" : " ") + t;
    } else {
      out.push(t);
    }
  }
  return out.join("\n");
}

/** PDF urywa nazwę dostawcy w dwóch liniach (np. FUTURE TECHNOLOGY + AND DEVELOPMENT). */
function mergeSplitSupplierNames(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const hasLoc = /\t\s*(POLSKA|ZAGRANICA|IMPORT)\s*\t/i.test(t);
    const prev = out[out.length - 1] ?? "";
    const prevHasLoc = /\t\s*(POLSKA|ZAGRANICA|IMPORT)\s*\t/i.test(prev);
    if (hasLoc && out.length && !prevHasLoc && !/^DOSTAWCY/i.test(prev)) {
      const tab = t.indexOf("\t");
      const nameRest = tab >= 0 ? t.slice(tab) : "";
      const namePart = tab >= 0 ? t.slice(0, tab).trim() : t;
      out[out.length - 1] = `${prev.trim()} ${namePart}${nameRest}`;
    } else {
      out.push(t);
    }
  }
  return out.join("\n");
}

function normalizeLocation(loc: string): UstawieniaRow["location"] | null {
  const u = loc.trim().toUpperCase();
  if (u === "POLSKA" || u === "ZAGRANICA" || u === "IMPORT") return u;
  return null;
}

function rowFromParts(parts: string[], statsRaw: string): UstawieniaRow | null {
  const filtered = parts.map((p) => p.trim()).filter((p) => p.length > 0);
  if (filtered.length < 3) return null;

  const locIdx = filtered.findIndex((p, i) => i > 0 && normalizeLocation(p));
  if (locIdx < 0) return null;

  let name = filtered[0];
  if (/^DOSTAWCY$/i.test(name) && locIdx > 0) {
    name = filtered[locIdx - 1];
  }
  if (!name || /^DOSTAWCY$/i.test(name)) return null;

  const location = normalizeLocation(filtered[locIdx])!;
  const pickup = filtered[locIdx + 1] ?? "BRAK";
  let notes = filtered[locIdx + 2] ?? "";

  const { stockRaw, intervalRaw, tailStart } = splitStockInterval(filtered, locIdx);
  let mails = filtered[locIdx + 3] ?? "";
  let extra = filtered
    .slice(locIdx + 4, tailStart)
    .filter(Boolean)
    .join(" · ");

  if (
    /@|https?:\/\//i.test(notes) &&
    !/^(MAILOWO|TELEFONICZNIE|PRZEZ INTERNET)$/i.test(notes.trim())
  ) {
    const contact = notes;
    notes = "MAILOWO";
    if (!/@|https?:\/\//i.test(mails)) {
      if (mails) extra = [mails, extra].filter(Boolean).join(" · ");
      mails = contact;
    }
  }

  const intervalParsed = parseInterval(intervalRaw);
  const pickupParsed = parsePickup(pickup);
  return {
    name,
    location,
    ...pickupParsed,
    notes: notes || (/@|https?:\/\//i.test(mails) ? "MAILOWO" : ""),
    mails,
    extra_info: extra,
    stock_raw: stockRaw,
    stock_weeks: parseStockWeeks(stockRaw),
    interval_raw: intervalRaw,
    interval_weeks: intervalWeeksForStorage(intervalRaw, intervalParsed),
    stats_mode: parseStats(statsRaw),
  };
}

/** PDF czasem urywa wiersz przed kolumną STATYSTYKI — domykamy przed kolejnym dostawcą. */
function closeIncompleteRows(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] ?? "";
    out.push(line);
    const lineDone = /\t(ŁĄCZNIE|LACZNIE|OSOBNO)\s*$/i.test(line);
    const nextIsSupplier =
      /^\s*[^\t\n]/.test(next) && /\t\s*(POLSKA|ZAGRANICA|IMPORT)\s*\t/i.test(next);
    if (line.trim() && nextIsSupplier && !lineDone) {
      out.push("\tŁĄCZNIE");
    }
  }
  return out.join("\n");
}

function parseText(text: string): UstawieniaRow[] {
  const cleaned = closeIncompleteRows(
    mergeMultilineUstawieniaRows(
      mergeSplitSupplierNames(
        text
          .replace(/\r/g, "")
          .replace(/\t+/g, "\t")
          .replace(/^DOSTAWCY\t.*\n/gm, "")
      )
    )
  );

  const rows: UstawieniaRow[] = [];
  const re = /\t(ŁĄCZNIE|LACZNIE|OSOBNO)\s*\n?/gi;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(cleaned)) !== null) {
    const chunk = cleaned.slice(last, m.index);
    const statsRaw = m[1];
    last = m.index + m[0].length;

    const flat = chunk.replace(/\n/g, "").trim();
    if (!flat) continue;

    const parts = flat.split("\t");
    const row = rowFromParts(parts, statsRaw);
    if (row) rows.push(row);
  }

  const byName = new Map<string, UstawieniaRow>();
  for (const r of rows) byName.set(r.name, r);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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
  const rawPath = join(root, "data", "ustawienia.raw.txt");
  console.log(fromRaw ? "Źródło: raw txt" : "PDF:", pdfPath);
  let text: string;
  if (fromRaw) {
    text = readFileSync(rawPath, "utf-8");
  } else {
    text = await extractPdfText(pdfPath);
    mkdirSync(join(root, "data"), { recursive: true });
    writeFileSync(rawPath, text, "utf-8");
    console.log("Zapisano surowy tekst →", rawPath);
  }
  const rows = parseText(text);

  const dataDir = join(root, "data");
  mkdirSync(dataDir, { recursive: true });

  const headers = [
    "DOSTAWCY",
    "LOKALIZACJA",
    "ODBIÓR",
    "SPOSÓB",
    "MAILE / STRONY",
    "DODATKOWE",
    "ZAPAS",
    "INTERWAL",
    "STATYSTYKI",
  ];

  const csvLines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.name,
        r.location,
        r.pickup_raw,
        r.notes,
        r.mails,
        r.extra_info,
        r.stock_raw,
        r.interval_raw,
        r.stats_mode === "OSOBNO" ? "OSOBNO" : "ŁĄCZNIE",
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];

  writeFileSync(join(dataDir, "ustawienia.csv"), csvLines.join("\n"), "utf-8");
  writeFileSync(
    join(dataDir, "ustawienia.json"),
    JSON.stringify(rows, null, 2),
    "utf-8"
  );

  const byLoc = { POLSKA: 0, ZAGRANICA: 0, IMPORT: 0 };
  for (const r of rows) byLoc[r.location]++;
  console.log(`Zapisano ${rows.length} dostawców → data/ustawienia.csv`);
  console.log("  POLSKA:", byLoc.POLSKA, "| ZAGRANICA:", byLoc.ZAGRANICA, "| IMPORT:", byLoc.IMPORT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
