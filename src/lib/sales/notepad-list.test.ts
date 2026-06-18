import { describe, expect, it } from "vitest";
import { mergeRecordsByUpdatedAt, uniqueById } from "./notepad-list";

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

describe("mergeRecordsByUpdatedAt", () => {
  it("zachowuje lokalny rekord gdy ma nowsze updated_at", () => {
    const local = [{ id: "a", updated_at: "2026-06-09T12:00:00.000Z", v: 2 }];
    const server = [{ id: "a", updated_at: "2026-06-09T11:00:00.000Z", v: 1 }];
    expect(mergeRecordsByUpdatedAt(local, server)).toEqual(local);
  });

  it("przy tym samym updated_at wygrywa lokalna kopia", () => {
    const local = [{ id: "a", updated_at: "2026-06-09T12:00:00.000Z", v: 2 }];
    const server = [{ id: "a", updated_at: "2026-06-09T12:00:00.000Z", v: 1 }];
    expect(mergeRecordsByUpdatedAt(local, server)).toEqual(local);
  });

  it("bierze serwer gdy jest nowszy", () => {
    const local = [{ id: "a", updated_at: "2026-06-09T11:00:00.000Z", v: 1 }];
    const server = [{ id: "a", updated_at: "2026-06-09T12:00:00.000Z", v: 2 }];
    expect(mergeRecordsByUpdatedAt(local, server)).toEqual(server);
  });
});
