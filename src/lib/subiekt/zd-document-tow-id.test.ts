import { describe, expect, it } from "vitest";
import { zdDocumentContainsTowId } from "./zd-document-tow-id";
import type { SubiektDocument } from "./types";

describe("zdDocumentContainsTowId", () => {
  it("wymaga tw_Id na linii dokumentu", () => {
    const doc: SubiektDocument = {
      dok_Id: 1,
      dok_Pozycja: [{ tw_Symbol: "MSDHLGY-104C", ob_TowId: 16012 }],
    };
    expect(zdDocumentContainsTowId(doc, 16012)).toBe(true);
    expect(zdDocumentContainsTowId(doc, 999)).toBe(false);
  });
});
