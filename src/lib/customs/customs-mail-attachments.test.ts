import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage/local", () => ({
  readStorageObject: vi.fn(async (path: string) => Buffer.from(`plik:${path}`)),
}));
vi.mock("@/lib/customs/customs-excel", () => ({
  buildCustomsClearanceWorkbook: vi.fn(async () => Buffer.from("xlsx")),
}));

import { collectCustomsMailAttachments, customsExcelFileName } from "./customs-mail-attachments";

/** Minimalny klient: dwie tabele, łańcuch select/eq/single i select/in. */
function db(invoice: { invoice_storage_path: string | null; invoice_file_name: string | null }, docs: object[]) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: table === "customs_clearances" ? invoice : null }) }),
        in: async () => ({ data: docs }),
      }),
    }),
  } as never;
}

const view = (attachments: { id: string }[]) =>
  ({ id: "c0ffee00-0000-4000-8000-000000000001", invoiceNumber: "INV 7/2026", attachments }) as never;

describe("collectCustomsMailAttachments", () => {
  it("faktura, dokumenty w kolejności odprawy, Excel na końcu", async () => {
    const files = await collectCustomsMailAttachments(
      db({ invoice_storage_path: "inv/1.pdf", invoice_file_name: "Faktura.PDF" }, [
        { id: "d2", storage_path: "docs/b.pdf", file_name: "Deklaracja B.pdf", mime_type: "application/pdf" },
        { id: "d1", storage_path: "docs/a.pdf", file_name: "Deklaracja A.pdf", mime_type: "application/pdf" },
      ]),
      view([{ id: "d1" }, { id: "d2" }]),
      true
    );
    expect(files.map((f) => f.filename)).toEqual(["Faktura.PDF", "Deklaracja A.pdf", "Deklaracja B.pdf", "odprawa_INV_7_2026.xlsx"]);
    expect(files[0]!.contentType).toBe("application/pdf");
    expect(files[3]!.contentType).toContain("spreadsheetml");
  });

  it("bez Excela i bez faktury — tylko to, co istnieje", async () => {
    const files = await collectCustomsMailAttachments(db({ invoice_storage_path: null, invoice_file_name: null }, []), view([]), false);
    expect(files).toEqual([]);
  });

  it("nazwa Excela bez znaków niedozwolonych w pliku", () => {
    expect(customsExcelFileName({ invoiceNumber: "FV/12:3", id: "x" })).toBe("odprawa_FV_12_3.xlsx");
  });
});
