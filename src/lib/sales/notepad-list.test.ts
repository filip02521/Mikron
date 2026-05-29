import { describe, expect, it } from "vitest";
import { uniqueById } from "./notepad-list";

describe("uniqueById", () => {
  it("usuwa duplikaty zachowując pierwszy wpis", () => {
    const items = [
      { id: "a", v: 1 },
      { id: "b", v: 2 },
      { id: "a", v: 3 },
    ];
    expect(uniqueById(items)).toEqual([
      { id: "a", v: 1 },
      { id: "b", v: 2 },
    ]);
  });
});
