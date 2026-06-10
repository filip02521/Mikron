import { describe, expect, it } from "vitest";
import {
  LOGIN_SUBTITLE_MANUAL,
  LOGIN_SUBTITLE_PICKER,
  LOGIN_SUBTITLE_QUICK,
  loginSubtitleForMode,
} from "./login-form-copy";

describe("loginSubtitleForMode", () => {
  it("zwraca copy dla każdego trybu", () => {
    expect(loginSubtitleForMode("quick")).toBe(LOGIN_SUBTITLE_QUICK);
    expect(loginSubtitleForMode("picker")).toBe(LOGIN_SUBTITLE_PICKER);
    expect(loginSubtitleForMode("manual")).toBe(LOGIN_SUBTITLE_MANUAL);
  });
});
