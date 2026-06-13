import { describe, expect, it } from "vitest";
import {
  toPublicLoginDirectoryAccounts,
  type LoginDirectoryAccountPublic,
} from "@/lib/auth/login-directory-public";
import type { LoginDirectoryAccount } from "@/lib/auth/login-directory";

describe("toPublicLoginDirectoryAccounts", () => {
  it("usuwa e-mail z kont przekazywanych do klienta", () => {
    const accounts: LoginDirectoryAccount[] = [
      {
        id: "acc-1",
        email: "jan@firma.pl",
        role: "admin",
        roleLabel: "Administrator",
        displayName: "Jan",
        salesPersonName: null,
      },
    ];

    const publicAccounts = toPublicLoginDirectoryAccounts(accounts);
    expect(publicAccounts).toEqual([
      {
        id: "acc-1",
        role: "admin",
        roleLabel: "Administrator",
        displayName: "Jan",
        salesPersonName: null,
      } satisfies LoginDirectoryAccountPublic,
    ]);
    expect(publicAccounts[0]).not.toHaveProperty("email");
  });
});
