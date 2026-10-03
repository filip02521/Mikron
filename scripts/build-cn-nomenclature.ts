/**
 * Słownik Nomenklatury Scalonej (CN) dla odpraw: kody 8-cyfrowe z opisem + nagłówki pozycji (4 cyfry).
 *
 * Źródło: GUS, „Combined Nomenclature 2026 — self-explanatory texts” (xlsx):
 * https://stat.gov.pl/en/intrastat/combined-nomenclature-self-explanatory-texts-excel-file/
 *
 * Użycie (raz w roku, po publikacji nowej CN):
 *   npx tsx scripts/build-cn-nomenclature.ts <plik.xlsx> 2026
 * Wynik: src/lib/customs/cn-nomenclature.json
 */
import { writeFileSync } from "fs";
import path from "path";
import ExcelJS from "exceljs";

async function main() {
  const [file, year] = process.argv.slice(2);
  if (!file || !/^\d{4}$/.test(year ?? "")) throw new Error("Użycie: build-cn-nomenclature.ts <plik.xlsx> <rok>");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0]!;
  const codes: Record<string, string> = {};
  const headings: Record<string, string> = {};
  ws.eachRow((row) => {
    const label = String(row.getCell(2).value ?? "").trim();
    const text = String(row.getCell(3).value ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;
    if (/^\d{4} \d{2} \d{2}$/.test(label)) codes[label.replace(/ /g, "")] = text;
    else if (/^\d{4}$/.test(label)) headings[label] = text;
  });
  const n = Object.keys(codes).length;
  if (n < 9000) throw new Error(`Za mało kodów (${n}) — zły plik?`);
  const out = path.join(process.cwd(), "src/lib/customs/cn-nomenclature.json");
  writeFileSync(out, JSON.stringify({ year: Number(year), codes, headings }));
  console.log(`CN ${year}: ${n} kodów 8-cyfrowych, ${Object.keys(headings).length} pozycji → ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
