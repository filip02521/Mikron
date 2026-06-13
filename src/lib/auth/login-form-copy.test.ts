import { describe, expect, it } from "vitest";
import {
  LOGIN_RESET_LINK_HINT,
  LOGIN_RESET_LINK_LABEL,
  loginSubtitleForMode,
  loginTitleForMode,
} from "@/lib/auth/login-form-copy";

describe("login form copy", () => {
  it("opisuje link resetu hasła przy logowaniu", () => {
    expect(LOGIN_RESET_LINK_LABEL).toBe("Reset hasła");
    expect(LOGIN_RESET_LINK_HINT).toContain("Kod");
  });

  it("zmienia tytuł i subtitle dla resetu hasła", () => {
    expect(loginTitleForMode("reset")).toBe("Reset hasła");
    expect(loginSubtitleForMode("reset")).toContain("6-cyfrowy kod");
  });
});
