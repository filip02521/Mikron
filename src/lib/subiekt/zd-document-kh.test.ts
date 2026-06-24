import { describe, expect, it } from "vitest";
import {
  extractListItemKhIds,
  zdListItemMatchesSupplierKhIds,
} from "./zd-document-kh";

describe("zdListItemMatchesSupplierKhIds", () => {
  it("akceptuje wiersz listy z dok_OdbiorcaId dostawcy", () => {
    expect(
      zdListItemMatchesSupplierKhIds(
        { dok_Id: 1, dok_OdbiorcaId: 28295, dok_PlatnikId: 28295 },
        [28295]
      )
    ).toBe(true);
  });

  it("odrzuca wiersz listy innego kontrahenta (fałszywe trafienie id/symbol)", () => {
    expect(
      zdListItemMatchesSupplierKhIds(
        { dok_Id: 2, dok_OdbiorcaId: 2110, dok_PlatnikId: 2110 },
        [28295]
      )
    ).toBe(false);
  });

  it("extractListItemKhIds — kh__Kontrahent_*", () => {
    expect(
      extractListItemKhIds({
        dok_Id: 3,
        kh__Kontrahent_Odbiorca: { kh_Id: 9001 },
      })
    ).toEqual([9001]);
  });
});
