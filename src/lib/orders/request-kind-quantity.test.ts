import { describe, expect, it } from "vitest";
import {
  applyInformacjaQuantityClear,
  applyZamowienieQuantityRestore,
  formatZkQuantityForDraft,
  pruneQuantityStash,
  resolveQuantityForZamowienie,
  snapshotNonEmptyQuantities,
  updateStashOnInformacjaEnter,
} from "./request-kind-quantity";

describe("request-kind-quantity", () => {
  it("snapshotNonEmptyQuantities: tylko niepuste", () => {
    expect(
      snapshotNonEmptyQuantities([
        { id: "a", quantity: "3" },
        { id: "b", quantity: "  " },
        { id: "c", quantity: "1.5" },
      ])
    ).toEqual({ a: "3", c: "1.5" });
  });

  it("updateStashOnInformacjaEnter: zapisuje niepuste i usuwa puste (brak stale)", () => {
    const afterFirst = updateStashOnInformacjaEnter(
      {},
      [
        { id: "a", quantity: "5" },
        { id: "b", quantity: "2" },
      ]
    );
    expect(afterFirst).toEqual({ a: "5", b: "2" });

    // Użytkownik skasował ilość na „a”, potem znowu wchodzi w informację
    const afterClear = updateStashOnInformacjaEnter(afterFirst, [
      { id: "a", quantity: "" },
      { id: "b", quantity: "2" },
    ]);
    expect(afterClear).toEqual({ b: "2" });
  });

  it("prune stash", () => {
    const stash = { a: "1", b: "2" };
    expect(pruneQuantityStash(stash, ["b"])).toEqual({ b: "2" });
    expect(pruneQuantityStash(stash, ["a", "b"])).toBe(stash);
  });

  it("formatZkQuantityForDraft", () => {
    expect(formatZkQuantityForDraft(5)).toBe("5");
    expect(formatZkQuantityForDraft(0)).toBeNull();
    expect(formatZkQuantityForDraft(null)).toBeNull();
    expect(formatZkQuantityForDraft(NaN)).toBeNull();
  });

  it("resolve: stash > zkQuantity > teeth > bieżące", () => {
    expect(
      resolveQuantityForZamowienie(
        { id: "x", quantity: "", zkQuantity: 10, teethDetails: [{}, {}] },
        { x: "7" }
      )
    ).toBe("7");
    expect(
      resolveQuantityForZamowienie(
        { id: "x", quantity: "", zkQuantity: 10, teethDetails: [{}, {}] },
        {}
      )
    ).toBe("10");
    expect(
      resolveQuantityForZamowienie(
        { id: "x", quantity: "", zkQuantity: null, teethDetails: [{}, {}, {}] },
        {}
      )
    ).toBe("3");
    expect(
      resolveQuantityForZamowienie({ id: "x", quantity: "", zkQuantity: null }, {})
    ).toBe("");
  });

  it("clear informacja: czyści niepuste, null gdy już puste", () => {
    const lines = [
      { id: "a", quantity: "2", zkQuantity: 2 },
      { id: "b", quantity: "", zkQuantity: 5 },
    ];
    expect(applyInformacjaQuantityClear(lines)).toEqual([
      { id: "a", quantity: "", zkQuantity: 2 },
      { id: "b", quantity: "", zkQuantity: 5 },
    ]);
    expect(
      applyInformacjaQuantityClear([
        { id: "a", quantity: "" },
        { id: "b", quantity: "  " },
      ])
    ).toBeNull();
  });

  it("restore: stash + zkQuantity, nie nadpisuje już wpisanych", () => {
    const lines = [
      { id: "a", quantity: "", zkQuantity: 4 },
      { id: "b", quantity: "1", zkQuantity: 9 },
      { id: "c", quantity: "", zkQuantity: null },
    ];
    expect(applyZamowienieQuantityRestore(lines, { a: "3", c: "8" })).toEqual([
      { id: "a", quantity: "3", zkQuantity: 4 },
      { id: "b", quantity: "1", zkQuantity: 9 },
      { id: "c", quantity: "8", zkQuantity: null },
    ]);
  });

  it("restore z samego zkQuantity (otwarte jako informacja z ZK)", () => {
    const lines = [
      { id: "a", quantity: "", zkQuantity: 12 },
      { id: "b", quantity: "", zkQuantity: 2 },
    ];
    expect(applyZamowienieQuantityRestore(lines, {})).toEqual([
      { id: "a", quantity: "12", zkQuantity: 12 },
      { id: "b", quantity: "2", zkQuantity: 2 },
    ]);
  });

  it("restore: null gdy nie ma czego przywrócić", () => {
    expect(
      applyZamowienieQuantityRestore(
        [{ id: "a", quantity: "", zkQuantity: null }],
        {}
      )
    ).toBeNull();
  });

  it("round-trip: zamowienie → informacja → zamowienie zachowuje edycję", () => {
    const original = [
      { id: "l1", quantity: "5", zkQuantity: 10 },
      { id: "l2", quantity: "2", zkQuantity: 2 },
    ];
    const stash = updateStashOnInformacjaEnter({}, original);
    const cleared = applyInformacjaQuantityClear(original)!;
    expect(cleared.every((l) => l.quantity === "")).toBe(true);
    expect(cleared.map((l) => l.zkQuantity)).toEqual([10, 2]);
    const restored = applyZamowienieQuantityRestore(cleared, stash)!;
    expect(restored.map((l) => l.quantity)).toEqual(["5", "2"]);
  });

  it("round-trip po ręcznym skasowaniu: nie wraca stara ilość, bierze zkQuantity", () => {
    let stash = updateStashOnInformacjaEnter({}, [
      { id: "a", quantity: "5", zkQuantity: 10 },
    ]);
    // powrót, użytkownik kasuje ilość, znowu informacja
    stash = updateStashOnInformacjaEnter(stash, [
      { id: "a", quantity: "", zkQuantity: 10 },
    ]);
    expect(stash).toEqual({});
    const restored = applyZamowienieQuantityRestore(
      [{ id: "a", quantity: "", zkQuantity: 10 }],
      stash
    );
    expect(restored).toEqual([{ id: "a", quantity: "10", zkQuantity: 10 }]);
  });
});
