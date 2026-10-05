import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { CUSTOMS_IMPORTER } from "@/lib/customs/customs-clearance";

export type ZdOrderPdfLine = { symbol: string | null; name: string; qty: number };

export type ZdOrderPdfInput = {
  dokNr: string;
  date: Date;
  supplierName: string;
  lines: ZdOrderPdfLine[];
  /** Dostawca zagraniczny / import → dokument po angielsku. */
  english: boolean;
};

const COPY = {
  pl: { title: "Zamówienie", date: "Data", supplier: "Dostawca", buyer: "Zamawiający", no: "Lp.", code: "Symbol", name: "Nazwa towaru", qty: "Ilość", page: "Strona", vat: "NIP" },
  en: { title: "Purchase order", date: "Date", supplier: "Supplier", buyer: "Buyer", no: "No.", code: "Code", name: "Description", qty: "Qty", page: "Page", vat: "VAT ID" },
} as const;

const A4: [number, number] = [595.28, 841.89];
const M = 48;
const INK = rgb(0.1, 0.12, 0.14);
const MUTED = rgb(0.42, 0.45, 0.48);
const RULE = rgb(0.82, 0.84, 0.86);
// Kolumny tabeli: Lp | Symbol | Nazwa | Ilość (x od lewego marginesu).
const COL = { no: M, code: M + 34, name: M + 150, qtyRight: A4[0] - M };
const NAME_W = COL.qtyRight - 70 - COL.name;

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatOrderQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 1000) / 1000).replace(".", ",");
}

/** Łamanie po słowach do szerokości; za długie słowo tnie znak po znaku. */
export function wrapText(text: string, maxWidth: number, width: (s: string) => number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (width(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) out.push(line);
    line = "";
    let rest = word;
    while (width(rest) > maxWidth) {
      let cut = rest.length - 1;
      while (cut > 1 && width(rest.slice(0, cut)) > maxWidth) cut -= 1;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

/** PDF zamówienia z pozycji ZD — załącznik do maila dla dostawców bez własnego formularza. */
export async function renderZdOrderPdf(input: ZdOrderPdfInput): Promise<Uint8Array> {
  const t = input.english ? COPY.en : COPY.pl;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(
    await readFile(path.join(process.cwd(), "data", "supplier-forms", "Geist-Regular.ttf")),
    { subset: true }
  );
  doc.setTitle(`${t.title} ${input.dokNr}`);
  doc.setAuthor(CUSTOMS_IMPORTER.name);

  const text = (page: PDFPage, s: string, x: number, y: number, size = 10, color = INK, f: PDFFont = font) =>
    page.drawText(s, { x, y, size, font: f, color });
  const right = (page: PDFPage, s: string, xRight: number, y: number, size = 10, color = INK) =>
    text(page, s, xRight - font.widthOfTextAtSize(s, size), y, size, color);

  const tableHeader = (page: PDFPage, y: number) => {
    text(page, t.no, COL.no, y, 9, MUTED);
    text(page, t.code, COL.code, y, 9, MUTED);
    text(page, t.name, COL.name, y, 9, MUTED);
    right(page, t.qty, COL.qtyRight, y, 9, MUTED);
    page.drawLine({ start: { x: M, y: y - 6 }, end: { x: COL.qtyRight, y: y - 6 }, thickness: 0.8, color: RULE });
    return y - 20;
  };

  let page = doc.addPage(A4);
  let y = A4[1] - M;
  text(page, `${t.title} ${input.dokNr}`, M, y - 4, 18);
  right(page, `${t.date}: ${isoDay(input.date)}`, COL.qtyRight, y, 10, MUTED);
  y -= 40;

  text(page, t.buyer, M, y, 9, MUTED);
  text(page, t.supplier, A4[0] / 2, y, 9, MUTED);
  y -= 14;
  const buyer = [
    CUSTOMS_IMPORTER.name,
    CUSTOMS_IMPORTER.street,
    CUSTOMS_IMPORTER.postalCity,
    `${t.vat}: PL${CUSTOMS_IMPORTER.nip}`,
  ];
  const supplier = wrapText(input.supplierName, A4[0] / 2 - M, (s) => font.widthOfTextAtSize(s, 10));
  for (let i = 0; i < Math.max(buyer.length, supplier.length); i += 1) {
    if (buyer[i]) text(page, buyer[i]!, M, y);
    if (supplier[i]) text(page, supplier[i]!, A4[0] / 2, y);
    y -= 14;
  }
  y = tableHeader(page, y - 18);

  input.lines.forEach((line, i) => {
    const nameLines = wrapText(line.name, NAME_W, (s) => font.widthOfTextAtSize(s, 10));
    const codeLines = wrapText(line.symbol ?? "", COL.name - COL.code - 10, (s) => font.widthOfTextAtSize(s, 10));
    const rows = Math.max(nameLines.length, codeLines.length);
    if (y - rows * 13 < M + 30) {
      page = doc.addPage(A4);
      y = tableHeader(page, A4[1] - M);
    }
    text(page, `${i + 1}.`, COL.no, y);
    right(page, formatOrderQty(line.qty), COL.qtyRight, y);
    for (let r = 0; r < rows; r += 1) {
      if (codeLines[r]) text(page, codeLines[r]!, COL.code, y - r * 13);
      if (nameLines[r]) text(page, nameLines[r]!, COL.name, y - r * 13);
    }
    y -= rows * 13 + 7;
  });

  const pages = doc.getPages();
  pages.forEach((p, i) =>
    right(p, `${input.dokNr} · ${t.page} ${i + 1}/${pages.length}`, COL.qtyRight, M - 20, 8, MUTED)
  );
  return doc.save();
}

/** Nazwa pliku: „Zamowienie ZD 123_26.pdf” / „Purchase order ZD 123_26.pdf”. */
export function zdOrderPdfFileName(dokNr: string, english: boolean): string {
  const safe = dokNr.replace(/[\\/:*?"<>|]+/g, "_").trim() || "ZD";
  return `${english ? "Purchase order" : "Zamowienie"} ${safe}.pdf`;
}
