import { describe, expect, it } from "vitest";
import { lineTowId } from "./zd-catalog-import";

describe("lineTowId", () => {
  it("zwraca tw_Id z linii dokumentu", () => {
    expect(lineTowId({ ob_TowId: 12345 } as never)).toBe(12345);
    expect(lineTowId({ ob_TowId: "99" } as never)).toBe(99);
  });

  it("pomija nieprawidłowe wartości", () => {
    expect(lineTowId({ ob_TowId: null } as never)).toBeNull();
    expect(lineTowId({ ob_TowId: 0 } as never)).toBeNull();
    expect(lineTowId({ ob_TowId: -1 } as never)).toBeNull();
    expect(lineTowId({} as never)).toBeNull();
  });
});
