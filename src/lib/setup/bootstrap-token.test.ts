import { describe, expect, it } from "vitest";
import { validateSetupToken } from "./bootstrap-token";

describe("validateSetupToken", () => {
  it("w dev bez SETUP_TOKEN zezwala", () => {
    const prev = process.env.NODE_ENV;
    const token = process.env.SETUP_TOKEN;
    (process.env as Record<string, string>).NODE_ENV = "development";
    delete process.env.SETUP_TOKEN;
    expect(validateSetupToken(undefined)).toBe(true);
    (process.env as Record<string, string>).NODE_ENV = prev;
    if (token) process.env.SETUP_TOKEN = token;
  });
});
