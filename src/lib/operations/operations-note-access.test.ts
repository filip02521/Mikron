import { describe, expect, it } from "vitest";
import { canMutateOperationsNote } from "./operations-note-access";

describe("canMutateOperationsNote", () => {
  it("pozwala autorowi na prywatną i publiczną", () => {
    expect(
      canMutateOperationsNote({
        visibility: "private",
        createdBy: "u1",
        userId: "u1",
        isAdmin: false,
      })
    ).toBe(true);
    expect(
      canMutateOperationsNote({
        visibility: "public",
        createdBy: "u1",
        userId: "u1",
        isAdmin: false,
      })
    ).toBe(true);
  });

  it("blokuje cudzą prywatną dla nie-admina", () => {
    expect(
      canMutateOperationsNote({
        visibility: "private",
        createdBy: "u1",
        userId: "u2",
        isAdmin: false,
      })
    ).toBe(false);
  });

  it("pozwala na cudzą publiczną każdemu z działu", () => {
    expect(
      canMutateOperationsNote({
        visibility: "public",
        createdBy: "u1",
        userId: "u2",
        isAdmin: false,
      })
    ).toBe(true);
  });

  it("admin może wszystko", () => {
    expect(
      canMutateOperationsNote({
        visibility: "private",
        createdBy: "u1",
        userId: "u2",
        isAdmin: true,
      })
    ).toBe(true);
  });
});
