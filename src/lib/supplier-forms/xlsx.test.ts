import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { getSupplierFormTemplate, type SupplierXlsxListTemplate } from "@/lib/supplier-forms/templates";
import { buildSupplierXlsxList } from "@/lib/supplier-forms/xlsx";

describe("Ivoclar - własny arkusz z Jm", () => {
  it("sortuje po nazwie, Jm zawsze szt.", async () => {
    const template = getSupplierFormTemplate("ivoclar-lista") as SupplierXlsxListTemplate;
    const bytes = await buildSupplierXlsxList(
      template,
      [
        { symbol: "605329", name: "IPS e.max CAD CEREC/inLab LT A2 C14/5", qty: 15, twId: 8098 },
        { symbol: "529479", name: "Chromascop", qty: 4, twId: 1 },
        { symbol: "540308 / SZAFKA", name: "Szafka na zęby Ivoclar z 6 szufladami", qty: 2, twId: 2 },
      ]
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    const rows = [1, 2, 3, 4].map((r) => [1, 2, 3, 4, 5].map((c) => ws.getRow(r).getCell(c).value));
    expect(rows).toEqual([
      ["Lp", "Symbol", "Nazwa", "Ilość", "Jm"],
      [1, 529479, "Chromascop", 4, "szt."],
      [2, 605329, "IPS e.max CAD CEREC/inLab LT A2 C14/5", 15, "szt."],
      [3, "540308 / SZAFKA", "Szafka na zęby Ivoclar z 6 szufladami", 2, "szt."],
    ]);
  });
});
