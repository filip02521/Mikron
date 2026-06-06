import { describe, expect, it } from "vitest";
import { editInitialFromForSomeoneGroup } from "./individual-request-edit-ui";
import type { SummaryForSomeoneEnriched } from "./summary-workspace";

function forSomeoneGroup(
  lines: SummaryForSomeoneEnriched["lines"]
): SummaryForSomeoneEnriched {
  return {
    kind: "forSomeone",
    supplierId: "s1",
    salesPersonId: "sp1",
    supplierName: "Dostawca",
    flaggedName: "Dostawca",
    location: "POLSKA",
    person: "Jan",
    displayText: "Jan",
    hoverNote: "",
    lines,
    orderIds: lines.map((l) => l.id),
    shift: "[DLA KOGOŚ]" as const,
    status: "Nowe",
    nextDate: new Date(),
    submittedAt: "2026-05-01",
    submittedAtLatest: "2026-05-01",
    hasUnseen: false,
    unseenCount: 0,
  };
}

describe("editInitialFromForSomeoneGroup", () => {
  it("rozpoznaje prośbę informacyjną — brak na stanie", () => {
    const initial = editInitialFromForSomeoneGroup(
      forSomeoneGroup([
        {
          id: "1",
          products: "Towar",
          symbol: "X",
          quantity: "-",
          fromSubiekt: false,
          submittedAt: "2026-05-01",
          informacjaStockOut: true,
        },
      ])
    );
    expect(initial.requestKind).toBe("informacja");
    expect(initial.informacjaPath).toBe("stock_out");
  });

  it("rozpoznaje zamówienie w [DLA KOGOŚ]", () => {
    const initial = editInitialFromForSomeoneGroup(
      forSomeoneGroup([
        {
          id: "2",
          products: "Towar",
          symbol: "Y",
          quantity: "2",
          fromSubiekt: true,
          submittedAt: "2026-05-01",
        },
      ])
    );
    expect(initial.requestKind).toBe("zamowienie");
    expect(initial.informacjaPath).toBeUndefined();
  });
});
