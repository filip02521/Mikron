import { describe, expect, it } from "vitest";
import {
  allProsbaLinesShareNote,
  copyProsbaLineNoteToAllLines,
  firstProsbaLineNote,
} from "./prosba-line-note-copy";
import { newProductLine } from "@/components/orders/request-product-lines";

describe("prosba-line-note-copy", () => {
  it("kopiuje pierwszą notatkę na wszystkie pozycje", () => {
    const lines = [
      { ...newProductLine(), id: "a", requestNote: "pilne w piątek" },
      { ...newProductLine(), id: "b", requestNote: "" },
    ];
    expect(copyProsbaLineNoteToAllLines(lines)).toEqual([
      { ...lines[0]!, requestNote: "pilne w piątek" },
      { ...lines[1]!, requestNote: "pilne w piątek" },
    ]);
  });

  it("nie kopiuje gdy jedna pozycja", () => {
    expect(
      copyProsbaLineNoteToAllLines([
        { ...newProductLine(), requestNote: "x" },
      ])
    ).toBeNull();
  });

  it("nie kopiuje gdy brak notatki", () => {
    expect(
      copyProsbaLineNoteToAllLines([
        newProductLine(),
        newProductLine(),
      ])
    ).toBeNull();
  });

  it("nie kopiuje gdy wszystkie mają tę samą notatkę", () => {
    const lines = [
      { ...newProductLine(), requestNote: "wspólna" },
      { ...newProductLine(), requestNote: "wspólna" },
    ];
    expect(copyProsbaLineNoteToAllLines(lines)).toBeNull();
    expect(allProsbaLinesShareNote(lines, "wspólna")).toBe(true);
  });

  it("firstProsbaLineNote bierze pierwszą niepustą", () => {
    expect(
      firstProsbaLineNote([
        { requestNote: "" },
        { requestNote: " druga " },
      ])
    ).toBe("druga");
  });
});
