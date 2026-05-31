import { describe, expect, it } from "vitest";
import {
  INFORMACJA_FLOW_DIRECT,
  INFORMACJA_FLOW_VIA_PANEL,
} from "./informacja-flow-copy";

describe("informacja-flow-copy", () => {
  it("definiuje dwie rozłączne ścieżki z krokami", () => {
    expect(INFORMACJA_FLOW_DIRECT.steps.length).toBeGreaterThan(1);
    expect(INFORMACJA_FLOW_VIA_PANEL.steps.length).toBeGreaterThan(
      INFORMACJA_FLOW_DIRECT.steps.length
    );
    expect(INFORMACJA_FLOW_VIA_PANEL.steps).toContain(
      "Zamówienie u dostawcy (Główne / Uzupełniające)"
    );
  });
});
