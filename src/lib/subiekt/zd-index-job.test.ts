import { describe, expect, it } from "vitest";
import { isZdIndexJobResumable } from "./zd-index-job";

describe("zd index job resume", () => {
  it("paused i failed można wznowić", () => {
    expect(
      isZdIndexJobResumable({
        status: "paused",
        dataOd: "2020-01-01",
        page: 42,
        pageSize: 25,
        totalPages: 200,
        processed: 120,
        mapped: 80,
        unmapped: 30,
        unverifiable: 10,
        lastDocNumber: "ZD/1",
        lastUpdatedAt: "",
        lastError: null,
      })
    ).toBe(true);
    expect(
      isZdIndexJobResumable({
        status: "failed",
        dataOd: "2020-01-01",
        page: 1,
        pageSize: 25,
        totalPages: null,
        processed: 0,
        mapped: 0,
        unmapped: 0,
        unverifiable: 0,
        lastDocNumber: null,
        lastUpdatedAt: "",
        lastError: "offline",
      })
    ).toBe(true);
    expect(isZdIndexJobResumable(null)).toBe(false);
    expect(
      isZdIndexJobResumable({
        status: "done",
        dataOd: "",
        page: 1,
        pageSize: 25,
        totalPages: 1,
        processed: 0,
        mapped: 0,
        unmapped: 0,
        unverifiable: 0,
        lastDocNumber: null,
        lastUpdatedAt: "",
        lastError: null,
      })
    ).toBe(false);
  });
});
