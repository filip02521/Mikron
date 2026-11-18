import { describe, expect, it } from "vitest";
import {
  boardQuestionDraftHasProduct,
  boardQuestionDraftLinkedToSubiekt,
  boardQuestionHasProduct,
  boardQuestionProductFieldsFromDraft,
  boardQuestionProductLabel,
  boardQuestionProductMetaLines,
  boardQuestionProductSearchText,
  emptyBoardQuestionProductDraft,
  BOARD_QUESTION_MAX_PRODUCTS,
  normalizeBoardQuestionProductInput,
  normalizeBoardQuestionProductList,
  initialBoardQuestionProductRows,
  newBoardQuestionProductRow,
} from "./question-product";

describe("question-product", () => {
  it("empty draft nie daje pól produktu", () => {
    expect(boardQuestionProductFieldsFromDraft(emptyBoardQuestionProductDraft())).toBeNull();
    expect(normalizeBoardQuestionProductInput(null)).toBeNull();
  });

  it("normalizuje i przycina pola produktu", () => {
    const fields = normalizeBoardQuestionProductInput({
      symbol: "  ABC-1  ",
      productName: "Nazwa towaru",
      subiektTwId: 42.9,
      mikranCode: " 00123 ",
    });

    expect(fields).toEqual({
      product_symbol: "ABC-1",
      product_name: "Nazwa towaru",
      subiekt_tw_id: 42,
      mikran_code: "00123",
    });
  });

  it("buduje etykietę i tekst wyszukiwania", () => {
    const thread = {
      product_symbol: "SYM-1",
      product_name: "Produkt testowy",
      subiekt_tw_id: 99,
      mikran_code: "555",
    };

    expect(boardQuestionHasProduct(thread)).toBe(true);
    expect(boardQuestionProductLabel(thread)).toBe("SYM-1 - Produkt testowy");
    expect(boardQuestionProductSearchText(thread)).toContain("SYM-1");
    expect(boardQuestionProductSearchText(thread)).toContain("555");
  });

  it("ignoruje placeholder symbolu „-”", () => {
    const thread = {
      product_symbol: "-",
      product_name: "Tylko nazwa",
      subiekt_tw_id: null,
      mikran_code: null,
    };
    expect(boardQuestionHasProduct(thread)).toBe(true);
    expect(boardQuestionProductLabel(thread)).toBe("Tylko nazwa");
    expect(
      normalizeBoardQuestionProductInput({
        symbol: "-",
        productName: "Tylko nazwa",
      })
    ).toEqual({
      product_symbol: null,
      product_name: "Tylko nazwa",
      subiekt_tw_id: null,
      mikran_code: null,
    });
  });

  it("wykrywa produkt w szkicu formularza", () => {
    expect(
      boardQuestionDraftHasProduct({
        symbol: "",
        product: "Nazwa",
        subiektTwId: null,
        mikranCode: "",
      })
    ).toBe(true);
    expect(
      boardQuestionDraftLinkedToSubiekt({
        symbol: "A",
        product: "B",
        subiektTwId: 12,
        mikranCode: "",
      })
    ).toBe(true);
  });

  it("zbiera linie metadanych produktu", () => {
    expect(
      boardQuestionProductMetaLines({
        product_symbol: "SYM",
        product_name: "Nazwa",
        subiekt_tw_id: 12,
        mikran_code: "001",
      })
    ).toEqual(["Symbol: SYM", "Kod Mikran: 001", "Powiązano z Subiektem"]);
  });

  it("lista produktów: pomija puste i powtórzone, trzyma kolejność", () => {
    const list = normalizeBoardQuestionProductList([
      { symbol: "A-1", productName: "Wiertło" },
      { symbol: "", productName: "  " },
      { subiektTwId: 7, productName: "Frez" },
      { symbol: "a-1", productName: "wiertło" },
      { subiektTwId: 7, productName: "Inna nazwa tego samego" },
      { mikranCode: "896" },
    ]);
    expect(list.map((p) => p.product_name ?? p.mikran_code)).toEqual(["Wiertło", "Frez", "896"]);
  });

  it("lista produktów: pojedynczy obiekt i null", () => {
    expect(normalizeBoardQuestionProductList({ symbol: "S" })).toHaveLength(1);
    expect(normalizeBoardQuestionProductList(null)).toEqual([]);
  });

  it("lista produktów: przycina do limitu", () => {
    const many = Array.from({ length: BOARD_QUESTION_MAX_PRODUCTS + 3 }, (_, i) => ({ symbol: `S${i}` }));
    expect(normalizeBoardQuestionProductList(many)).toHaveLength(BOARD_QUESTION_MAX_PRODUCTS);
  });

  it("pierwszy wiersz formularza ma ten sam klucz przy każdym renderze (serwer = przeglądarka)", () => {
    newBoardQuestionProductRow();
    expect(initialBoardQuestionProductRows()[0].key).toBe(initialBoardQuestionProductRows()[0].key);
    expect(newBoardQuestionProductRow().key).not.toBe(initialBoardQuestionProductRows()[0].key);
  });
});
