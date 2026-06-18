import { describe, expect, it } from "vitest";
import {
  editRequestNoteForSave,
  filterIndividualRequestEditLinesForSave,
  isIndividualOrderEditable,
  resolveIndividualRequestEditLineId,
  toIndividualRequestEditLinePayload,
} from "./individual-request-edit";
import type { IndividualOrder } from "@/types/database";

function order(partial: Partial<IndividualOrder>): IndividualOrder {
  return partial as IndividualOrder;
}

describe("isIndividualOrderEditable", () => {
  it("pozwala edytować częściową rezygnację przed zamówieniem u dostawcy", () => {
    expect(
      isIndividualOrderEditable(
        order({
          status: "Nowe",
          ordered_at: null,
          sales_cancelled_at: "2026-06-09T10:00:00Z",
          sales_acknowledged_at: null,
        })
      )
    ).toBe(true);
  });

  it("blokuje edycję po pełnej rezygnacji zamkniętej u handlowca", () => {
    expect(
      isIndividualOrderEditable(
        order({
          status: "Zamowione",
          ordered_at: null,
          sales_cancelled_at: "2026-06-09T10:00:00Z",
          sales_acknowledged_at: "2026-06-09T10:00:00Z",
        })
      )
    ).toBe(false);
  });

  it("blokuje edycję po złożeniu u dostawcy", () => {
    expect(
      isIndividualOrderEditable(
        order({
          status: "Nowe",
          ordered_at: "2026-06-09",
          sales_cancelled_at: null,
          sales_acknowledged_at: null,
        })
      )
    ).toBe(false);
  });
});

describe("resolveIndividualRequestEditLineId", () => {
  it("zwraca id tylko dla pozycji z edytowanej prośby", () => {
    expect(resolveIndividualRequestEditLineId("ord-1", ["ord-1", "ord-2"])).toBe("ord-1");
    expect(resolveIndividualRequestEditLineId("draft-new", ["ord-1"])).toBeUndefined();
    expect(resolveIndividualRequestEditLineId("", ["ord-1"])).toBeUndefined();
    expect(resolveIndividualRequestEditLineId(undefined, ["ord-1"])).toBeUndefined();
  });
});

describe("filterIndividualRequestEditLinesForSave", () => {
  const existing = {
    id: "ord-1",
    symbol: "A",
    mikranCode: "",
    product: "Produkt A",
    quantity: "1",
  };
  const draftNew = {
    id: "draft-ui",
    symbol: "",
    mikranCode: "",
    product: "",
    quantity: "",
  };
  const filledNew = {
    id: "draft-ui-2",
    symbol: "B",
    mikranCode: "",
    product: "Produkt B",
    quantity: "2",
  };

  it("pomija puste nowe wiersze z losowym id UI", () => {
    expect(
      filterIndividualRequestEditLinesForSave([existing, draftNew], ["ord-1"])
    ).toEqual([existing]);
  });

  it("zostawia wypełnione nowe wiersze", () => {
    expect(
      filterIndividualRequestEditLinesForSave([existing, filledNew], ["ord-1"])
    ).toEqual([existing, filledNew]);
  });

  it("zostawia istniejące wiersze nawet gdy użytkownik je wyczyścił", () => {
    const clearedExisting = { ...existing, product: "", symbol: "" };
    expect(
      filterIndividualRequestEditLinesForSave([clearedExisting], ["ord-1"])
    ).toEqual([clearedExisting]);
  });
});

describe("toIndividualRequestEditLinePayload", () => {
  it("mapuje nową linię bez id w payloadzie", () => {
    expect(
      toIndividualRequestEditLinePayload(
        {
          id: "draft-ui",
          symbol: "X",
          mikranCode: "",
          product: "Nowy",
          quantity: "1",
        },
        ["ord-1"]
      )
    ).toMatchObject({
      id: undefined,
      symbol: "X",
      product: "Nowy",
    });
  });
});

describe("editRequestNoteForSave", () => {
  it("zachowuje uwagi per linia gdy mieszane i pole nietknięte", () => {
    expect(
      editRequestNoteForSave("", { mixedOnLines: true, touched: false })
    ).toBeUndefined();
  });

  it("nadpisuje wspólną notatką po edycji przy mieszanych uwagach", () => {
    expect(
      editRequestNoteForSave("wspólna", { mixedOnLines: true, touched: true })
    ).toBe("wspólna");
  });

  it("czyści notatkę gdy użytkownik ją wyczyścił przy mieszanych uwagach", () => {
    expect(
      editRequestNoteForSave("", { mixedOnLines: true, touched: true })
    ).toBe("");
  });

  it("nie wysyła ponownie niezmienionej wspólnej notatki", () => {
    expect(
      editRequestNoteForSave("pilne", {
        mixedOnLines: false,
        touched: false,
        initialNote: "pilne",
      })
    ).toBeUndefined();
  });

  it("zapisuje pierwszą notatkę dodaną przy edycji", () => {
    expect(
      editRequestNoteForSave("pilne", {
        mixedOnLines: false,
        touched: true,
        initialNote: "",
      })
    ).toBe("pilne");
  });

  it("zapisuje notatkę gdy treść różni się od initial bez touched", () => {
    expect(
      editRequestNoteForSave("pilne", {
        mixedOnLines: false,
        touched: false,
        initialNote: "",
      })
    ).toBe("pilne");
  });

  it("zapisuje notatkę przy mieszanych uwagach gdy pole ma treść", () => {
    expect(
      editRequestNoteForSave("wspólna", {
        mixedOnLines: true,
        touched: false,
        initialNote: "",
      })
    ).toBe("wspólna");
  });
});
