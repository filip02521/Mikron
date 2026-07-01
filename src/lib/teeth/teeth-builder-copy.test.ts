import { describe, expect, it } from "vitest";
import {
  teethDualSaveBlockReason,
  teethDualSaveReady,
} from "@/lib/teeth/teeth-builder-copy";

describe("teethDualSaveReady", () => {
  const empty = { hasItems: false, complete: false };
  const complete = { hasItems: true, complete: true };
  const incomplete = { hasItems: true, complete: false };

  it("rejects when both sections empty", () => {
    expect(teethDualSaveReady(empty, empty)).toBe(false);
    expect(teethDualSaveBlockReason(empty, empty)).toMatch(/Dodaj co najmniej/);
  });

  it("accepts single complete section", () => {
    expect(teethDualSaveReady(complete, empty)).toBe(true);
    expect(teethDualSaveReady(empty, complete)).toBe(true);
  });

  it("rejects incomplete section with items", () => {
    expect(teethDualSaveReady(incomplete, empty)).toBe(false);
    expect(teethDualSaveBlockReason(incomplete, empty)).toMatch(/Przednie/);
    expect(teethDualSaveBlockReason(empty, incomplete)).toMatch(/Boczne/);
  });

  it("accepts both complete sections", () => {
    expect(teethDualSaveReady(complete, complete)).toBe(true);
    expect(teethDualSaveBlockReason(complete, complete)).toBeNull();
  });
});
