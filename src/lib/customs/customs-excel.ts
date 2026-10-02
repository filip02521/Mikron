import ExcelJS from "exceljs";
import { isLineComplete, type CustomsClearanceView } from "./customs-view";

/** Excel dla agencji celnej — jedna pozycja faktury na wiersz. */
export async function buildCustomsClearanceWorkbook(view: CustomsClearanceView): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "OnTime";
  const ws = wb.addWorksheet("Odprawa");

  ws.addRow([`Faktura ${view.invoiceNumber}`, view.invoiceDate ?? "", view.supplierName]);
  ws.addRow([`Przesyłka: ${view.shipmentDescription}`]);
  ws.addRow([]);

  const header = ws.addRow([
    "Lp.",
    "Kod dostawcy",
    "Nazwa na fakturze",
    "Opis PL",
    "Materiał",
    "Wyrób medyczny",
    "Kod CN",
    "VAT %",
    "Ilość",
    "Cena",
    "Wartość",
    `Waluta`,
    "Podstawa VAT",
  ]);
  header.font = { bold: true };

  for (const line of view.lines) {
    const complete = isLineComplete(line);
    const row = ws.addRow([
      line.position,
      line.supplierArticleCode,
      line.supplierName,
      line.card?.descriptionPl ?? "",
      line.card?.material ?? "",
      line.vat.isMedicalDevice ? "tak" : "nie",
      line.card?.cnCode ?? "",
      line.vat.rate,
      line.quantity,
      line.unitPrice,
      line.amount ?? (line.unitPrice != null ? Math.round(line.unitPrice * line.quantity * 100) / 100 : null),
      view.currency,
      line.vat.basisDocument?.fileName ?? "",
    ]);
    if (!complete) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF4E5" } };
    }
  }

  const widths = [6, 16, 36, 40, 26, 10, 12, 8, 8, 10, 12, 8, 28];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
