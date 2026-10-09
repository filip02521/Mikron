import { describe, expect, it } from "vitest";
import { EXTRA_ATTACHMENTS_MAX_BYTES, extraAttachmentsError } from "./extra-attachments";

describe("extraAttachmentsError", () => {
  it("przepuszcza PDF, Excel i zdjęcia", () => {
    expect(extraAttachmentsError([])).toBeNull();
    expect(extraAttachmentsError([{ name: "Zam 12.PDF", size: 10 }, { name: "a.xlsx", size: 1 }, { name: "f.jpg", size: 5 }])).toBeNull();
  });
  it("odrzuca inne typy, puste pliki, za dużo plików i za dużą sumę", () => {
    expect(extraAttachmentsError([{ name: "x.exe", size: 1 }])).toMatch(/x\.exe/);
    expect(extraAttachmentsError([{ name: "bez-rozszerzenia", size: 1 }])).toMatch(/dozwolone/);
    expect(extraAttachmentsError([{ name: "a.pdf", size: 0 }])).toMatch(/pusty/);
    expect(extraAttachmentsError(Array.from({ length: 11 }, (_, i) => ({ name: `${i}.pdf`, size: 1 })))).toMatch(/10/);
    expect(extraAttachmentsError([{ name: "a.pdf", size: EXTRA_ATTACHMENTS_MAX_BYTES }, { name: "b.pdf", size: 1 }])).toMatch(/15 MB/);
  });
});
