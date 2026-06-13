import { describe, expect, it } from "vitest";
import {
  loginSubtitleForMode,
  loginTitleForMode,
} from "@/lib/auth/login-form-copy";

describe("login form copy", () => {
  it("zmienia tytuł i subtitle dla resetu hasła", () => {
    expect(loginTitleForMode("reset")).toBe("Reset hasła");
    expect(loginSubtitleForMode("reset")).toContain("6-cyfrowy kod");
  });
});
