import { describe, expect, it } from "vitest";
import {
  buildUserEditsFromRows,
  userRowHasUnsavedChanges,
  usersAdminListSignature,
  usersManagerGroupsSignature,
} from "./users-admin-sync";
import type { AppUserRow } from "@/lib/data/users";

const row = (patch: Partial<AppUserRow>): AppUserRow => ({
  id: "u1",
  email: "a@b.pl",
  role: "zakupy",
  salesPersonId: null,
  salesPersonName: null,
  createdAt: "2020-01-01",
  lastSignInAt: null,
  ...patch,
});

describe("usersAdminListSignature", () => {
  it("jest taki sam dla tej samej treści w nowej tablicy", () => {
    const a = [row({ id: "1", role: "sales" })];
    const b = [row({ id: "1", role: "sales" })];
    expect(usersAdminListSignature(a)).toBe(usersAdminListSignature(b));
  });

  it("zmienia się przy innej roli", () => {
    const zakupy = usersAdminListSignature([row({ role: "zakupy" })]);
    const sales = usersAdminListSignature([row({ role: "sales" })]);
    expect(zakupy).not.toBe(sales);
  });
});

describe("usersManagerGroupsSignature", () => {
  it("ignoruje kolejność kluczy i grup", () => {
    const a = { u1: ["g2", "g1"], u2: ["g3"] };
    const b = { u2: ["g3"], u1: ["g1", "g2"] };
    expect(usersManagerGroupsSignature(a)).toBe(usersManagerGroupsSignature(b));
  });
});

describe("buildUserEditsFromRows", () => {
  it("mapuje role i handlowca", () => {
    expect(
      buildUserEditsFromRows([row({ id: "x", role: "sales", salesPersonId: "sp1" })])
    ).toEqual({ x: { role: "sales", salesPersonId: "sp1" } });
  });
});

describe("userRowHasUnsavedChanges", () => {
  it("wykrywa zmianę roli", () => {
    const u = row({ id: "u1", role: "zakupy" });
    expect(
      userRowHasUnsavedChanges(
        u,
        { role: "sales", salesPersonId: "sp1" },
        [],
        []
      )
    ).toBe(true);
  });

  it("wykrywa zmianę grup kierownika bez zmiany roli", () => {
    const u = row({ id: "u1", role: "sales_manager" });
    expect(
      userRowHasUnsavedChanges(
        u,
        { role: "sales_manager", salesPersonId: "sp1" },
        ["g2"],
        ["g1"]
      )
    ).toBe(true);
  });

  it("false gdy zgodne z zapisanym", () => {
    const u = row({ id: "u1", role: "sales", salesPersonId: "sp1" });
    expect(
      userRowHasUnsavedChanges(
        u,
        { role: "sales", salesPersonId: "sp1" },
        [],
        []
      )
    ).toBe(false);
  });
});
