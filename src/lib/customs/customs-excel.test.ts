import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildCustomsClearanceWorkbook } from "./customs-excel";
import { buildCustomsClearanceSummary, buildCustomsLineViews, type CustomsClearanceView } from "./customs-view";
import { buildDocumentArticleIndex } from "./customs-clearance";

describe("buildCustomsClearanceWorkbook", () => {
  it("zapisuje pozycje z opisem, CN, VAT i podstawą 8%", async () => {
    const doc = { id: "d1", fileName: "deklaracja.pdf", description: "" };
    const lines = buildCustomsLineViews({
      lines: [
        { id: "l1", position: 1, supplier_article_code: "DE-1698", supplier_name: "Scalpel handle", quantity: "20", unit: "szt.", unit_price: "2.1", amount: null, zd_quantity: null },
        { id: "l2", position: 2, supplier_article_code: "DE-1196", supplier_name: "Plaster knife", quantity: 10, unit: "szt.", unit_price: null, amount: null, zd_quantity: null },
      ],
      cardsByCode: new Map([
        ["DE-1698", { id: "c1", supplier_article_code: "DE-1698", description_pl: "Uchwyt do skalpela nr 3", material: "stal nierdzewna", cn_code: "90184900", is_medical_device: true, vat_rate: 8, vat_basis_document_id: "d1", status: "confirmed" as const, source: "manual" as const, confirmed_at: "2026-04-20T10:00:00Z" }],
      ]),
      documentIndex: buildDocumentArticleIndex([{ supplierArticleCode: "DE-1698", document: doc }]),
    });
    const view: CustomsClearanceView = {
      id: "x", supplierId: "s", supplierName: "Aswad", zdNumber: null, invoiceNumber: "AI/3177/26",
      invoiceDate: "2026-04-20", currency: "EUR", shipmentDescription: "przyrządy", invoiceFileName: null,
      status: "draft", sentAt: null, sentEmailText: null, lines, documents: [],
      ...buildCustomsClearanceSummary({ lines, shipmentDescription: "przyrządy" }),
    };
    expect(view.incompleteCount).toBe(1);
    expect(view.attachments).toEqual([doc]);

    const wb = new ExcelJS.Workbook();
    const buffer = await buildCustomsClearanceWorkbook(view);
    await wb.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
    const ws = wb.getWorksheet("Odprawa")!;
    expect(ws.getRow(5).values).toEqual([
      undefined, 1, "DE-1698", "Scalpel handle", "Uchwyt do skalpela nr 3", "stal nierdzewna", "tak", "90184900", 8, 20, 2.1, 42, "EUR", "deklaracja.pdf",
    ]);
    expect(ws.getRow(6).getCell(4).value).toBe("");
  });
});
