import { describe, expect, it } from "vitest";
import {
  INFORMACJA_FLOW_DIRECT,
  INFORMACJA_FLOW_STOCK_OUT,
} from "./informacja-flow-copy";
import {
  DEFAULT_INFORMACJA_FLOW_PATH,
  INFORMACJA_FLOW_UI,
  informacjaFlowPickerOptions,
} from "./informacja-flow-ui";

describe("informacja-flow-copy", () => {
  it("definiuje dwie ścieżki w formularzu handlowca", () => {
    expect(INFORMACJA_FLOW_DIRECT.label).toBe("Informacja o dostępności");
    expect(INFORMACJA_FLOW_STOCK_OUT.short).toContain("działu zakupów");
    expect(INFORMACJA_FLOW_UI).toHaveLength(2);
    expect(INFORMACJA_FLOW_UI[0]!.path).toBe("direct");
    expect(DEFAULT_INFORMACJA_FLOW_PATH).toBe("direct");
  });

  it("panel dzienny ma dodatkową ścieżkę via_panel", () => {
    const daily = informacjaFlowPickerOptions({ includeViaPanel: true });
    expect(daily).toHaveLength(3);
    expect(daily.map((o) => o.path)).toEqual(["direct", "via_panel", "stock_out"]);
  });
});
