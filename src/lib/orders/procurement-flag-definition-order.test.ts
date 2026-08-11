import { describe, expect, it } from "vitest";
import type { ProcurementFlagDefinition } from "./procurement-request-flag";
import {
  activeFlagDefinitionIndex,
  reorderActiveFlagDefinitions,
} from "./procurement-flag-definition-order";

function def(
  id: string,
  sortOrder: number,
  isActive = true
): ProcurementFlagDefinition {
  return {
    id,
    label: id.slice(0, 8),
    color: "rose",
    sortOrder,
    isActive,
  };
}

describe("reorderActiveFlagDefinitions", () => {
  it("przesuwa aktywną w dół i przepisuje sortOrder", () => {
    const defs = [
      def("11111111-1111-4111-8111-111111111101", 0),
      def("11111111-1111-4111-8111-111111111102", 1),
      def("11111111-1111-4111-8111-111111111103", 2),
      def("11111111-1111-4111-8111-111111111104", 9, false),
    ];
    const result = reorderActiveFlagDefinitions(defs, 0, 1);
    expect(result).not.toBeNull();
    expect(result!.orderedIds.slice(0, 3)).toEqual([
      "11111111-1111-4111-8111-111111111102",
      "11111111-1111-4111-8111-111111111101",
      "11111111-1111-4111-8111-111111111103",
    ]);
    expect(result!.definitions.map((d) => d.sortOrder)).toEqual([0, 1, 2, 3]);
    expect(result!.definitions[3]!.isActive).toBe(false);
  });

  it("null poza zakresem", () => {
    const defs = [def("11111111-1111-4111-8111-111111111101", 0)];
    expect(reorderActiveFlagDefinitions(defs, 0, -1)).toBeNull();
    expect(reorderActiveFlagDefinitions(defs, 0, 1)).toBeNull();
  });
});

describe("activeFlagDefinitionIndex", () => {
  it("zwraca indeks w posortowanych aktywnych", () => {
    const defs = [
      def("11111111-1111-4111-8111-111111111102", 1),
      def("11111111-1111-4111-8111-111111111101", 0),
    ];
    expect(
      activeFlagDefinitionIndex(defs, "11111111-1111-4111-8111-111111111102")
    ).toBe(1);
  });
});
