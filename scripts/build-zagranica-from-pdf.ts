/**
 * Parsuje arkusz ZAGRANICA (PDF) → data/zagranica-schedules.json
 *
 *   npx tsx scripts/build-zagranica-from-pdf.ts [ścieżka-pdf]
 *   npx tsx scripts/build-zagranica-from-pdf.ts --from-raw
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  extractPdfText,
  parseLocationScheduleText,
} from "./lib/location-schedule-pdf";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const defaultPdf =
  "/Users/Filip/Downloads/System Dostaw v.9 Synchronizacja DK z HI, Częściowa realizacja - ZAGRANICA.pdf";

async function main() {
  const fromRaw = process.argv.includes("--from-raw");
  const pdfPath =
    process.argv.find((a) => a.endsWith(".pdf")) || defaultPdf;
  const rawPath = join(root, "data", "zagranica.raw.txt");
  const dataDir = join(root, "data");
  mkdirSync(dataDir, { recursive: true });

  let text: string;
  if (fromRaw) {
    text = readFileSync(rawPath, "utf-8");
    console.log("Źródło: data/zagranica.raw.txt");
  } else {
    text = await extractPdfText(pdfPath);
    writeFileSync(rawPath, text, "utf-8");
    console.log("PDF:", pdfPath);
    console.log("Zapisano → data/zagranica.raw.txt");
  }

  const rows = parseLocationScheduleText(text);
  writeFileSync(
    join(dataDir, "zagranica-schedules.json"),
    JSON.stringify(rows, null, 2),
    "utf-8"
  );

  const csvHeader =
    "DOSTAWCA,DATA ZAMÓWIENIA,DATA KOLEJNEGO,PRZESUNIĘCIE,ZAPAS";
  const csvLines = rows.map(
    (r) =>
      `"${r.name.replace(/"/g, '""')}",${r.order_date ?? ""},${r.computed_next_date ?? ""},${r.shift_date ?? ""},${r.stock_raw}"`
  );
  writeFileSync(
    join(dataDir, "zagranica-schedules.csv"),
    [csvHeader, ...csvLines].join("\n"),
    "utf-8"
  );

  console.log(`Zapisano ${rows.length} dostawców ZAGRANICA`);
  console.log(
    `  z datą zamówienia: ${rows.filter((r) => r.order_date).length}, z datą kolejną: ${rows.filter((r) => r.computed_next_date).length}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
