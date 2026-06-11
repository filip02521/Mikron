import { describe, expect, it } from "vitest";
import {
  loginAccountCountLabel,
  loginAccountInitials,
} from "@/components/auth/login-account-picker-layout";

describe("login-account-picker-layout", () => {
  it("builds initials from display name", () => {
    expect(loginAccountInitials("Jan Kowalski")).toBe("JK");
    expect(loginAccountInitials("Anna")).toBe("AN");
    expect(loginAccountInitials("")).toBe("?");
  });

  it("formats account count in Polish", () => {
    expect(loginAccountCountLabel(1)).toBe("1 konto");
    expect(loginAccountCountLabel(3)).toBe("3 konta");
    expect(loginAccountCountLabel(12)).toBe("12 kont");
  });
});
