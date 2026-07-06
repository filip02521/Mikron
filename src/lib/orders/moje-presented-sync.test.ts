import { describe, expect, it } from "vitest";
import { mojePresentedSignature } from "./moje-presented-sync";
import type { MyOrderRow } from "./my-order-presenter";
import { createTestMyOrderRow } from "./test-fixtures";

function minimalRow(overrides: Partial<MyOrderRow> = {}): MyOrderRow {
  return createTestMyOrderRow(overrides);
}

describe("mojePresentedSignature", () => {
  it("różni się po zmianie clientLabel / clientName przy tych samych id", () => {
    const base = { zamowienia: [minimalRow()], informacje: [] };
    const withClient = {
      zamowienia: [
        minimalRow({
          clientLabel: "Kowalski",
          lines: [
            {
              ...minimalRow().lines[0],
              clientName: "Kowalski",
            },
          ],
        }),
      ],
      informacje: [],
    };
    expect(mojePresentedSignature(base)).not.toBe(mojePresentedSignature(withClient));
  });
});
