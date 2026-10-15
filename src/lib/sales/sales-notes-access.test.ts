import { describe, expect, it } from "vitest";
import { canReadSalesNotes } from "./sales-notes-access";

const none = { isOwner: false, isAdmin: false, isManagerInScope: false, isActiveDelegate: false };

describe("canReadSalesNotes", () => {
  it("nikt spoza czwórki nie czyta notatek", () => {
    expect(canReadSalesNotes(none)).toBe(false);
  });

  it.each(["isOwner", "isAdmin", "isManagerInScope", "isActiveDelegate"] as const)(
    "%s wystarcza do odczytu",
    (flag) => {
      expect(canReadSalesNotes({ ...none, [flag]: true })).toBe(true);
    }
  );
});
