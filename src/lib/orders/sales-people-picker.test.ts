import { describe, expect, it } from "vitest";
import {
  filterSalesPeopleByQuery,
  normalizeSalesPeopleForPicker,
} from "./sales-people-picker";

describe("sales-people-picker", () => {
  it("usuwa duplikaty po id", () => {
    const out = normalizeSalesPeopleForPicker([
      { id: "a", name: "Anna" },
      { id: "a", name: "Anna K." },
      { id: "b", name: "Bogdan" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]?.name).toBe("Anna");
  });

  it("filtruje po fragmencie imienia", () => {
    const people = normalizeSalesPeopleForPicker([
      { id: "1", name: "Kasia J." },
      { id: "2", name: "Paweł" },
    ]);
    expect(filterSalesPeopleByQuery(people, "kas")).toHaveLength(1);
  });
});
