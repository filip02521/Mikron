import { describe, expect, it } from "vitest";
import {
  assertPasswordChangeCompleted,
  isPasswordChangeExemptApiPath,
  mustChangePasswordBlocked,
  MUST_CHANGE_PASSWORD_MESSAGE,
} from "@/lib/auth/must-change-password-guard";

const baseUser = {
  mustChangePassword: false,
};

describe("mustChangePasswordBlocked", () => {
  it("returns null when password change is not required", () => {
    expect(mustChangePasswordBlocked(baseUser)).toBeNull();
    expect(mustChangePasswordBlocked(null)).toBeNull();
  });

  it("returns message when password change is required", () => {
    expect(
      mustChangePasswordBlocked({ ...baseUser, mustChangePassword: true })
    ).toBe(MUST_CHANGE_PASSWORD_MESSAGE);
  });
});

describe("assertPasswordChangeCompleted", () => {
  it("throws when password change is required", () => {
    expect(() =>
      assertPasswordChangeCompleted({ ...baseUser, mustChangePassword: true })
    ).toThrow(MUST_CHANGE_PASSWORD_MESSAGE);
  });
});

describe("isPasswordChangeExemptApiPath", () => {
  it("allows auth and health endpoints", () => {
    expect(isPasswordChangeExemptApiPath("/api/auth/login")).toBe(true);
    expect(isPasswordChangeExemptApiPath("/api/auth/password-reset/verify")).toBe(true);
    expect(isPasswordChangeExemptApiPath("/api/health")).toBe(true);
    expect(isPasswordChangeExemptApiPath("/api/cron/morning")).toBe(true);
  });

  it("blocks app API endpoints", () => {
    expect(isPasswordChangeExemptApiPath("/api/sales/activity-version")).toBe(false);
    expect(isPasswordChangeExemptApiPath("/api/operations/daily-panel-version")).toBe(false);
  });
});
