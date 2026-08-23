import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => false),
  };
});

import {
  getDefaultSenderAddress,
  getEmailFromAddress,
  getEmailOverrideTo,
  getSmtpPort,
  getSmtpSecure,
  isEmailConfigured,
} from "./email-config";

function stubSmtp(overrides: Record<string, string | undefined> = {}) {
  const base: Record<string, string | undefined> = {
    SMTP_HOST: "email-smtp.eu-central-1.amazonaws.com",
    SMTP_PORT: "587",
    SMTP_USER: "AKIAEXAMPLE",
    SMTP_PASS: "secret",
    SMTP_SECURE: "false",
    EMAIL_DOMAIN: "ontime.mikran.pl",
    EMAIL_FROM_LOCAL: "OnTime",
    EMAIL_FROM: undefined,
  };
  for (const [k, v] of Object.entries({ ...base, ...overrides })) {
    if (v === undefined) {
      vi.stubEnv(k, "");
      delete process.env[k];
    } else {
      vi.stubEnv(k, v);
    }
  }
}

describe("email-config (SES SMTP)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("isEmailConfigured = true przy SMTP + EMAIL_DOMAIN", () => {
    stubSmtp();
    expect(isEmailConfigured()).toBe(true);
  });

  it("isEmailConfigured = true przy SMTP + EMAIL_FROM z @ (bez domeny)", () => {
    stubSmtp({
      EMAIL_DOMAIN: undefined,
      EMAIL_FROM: "OnTime <tomek@ontime.mikran.pl>",
    });
    expect(isEmailConfigured()).toBe(true);
  });

  it("isEmailConfigured = false bez hasła SMTP", () => {
    stubSmtp({ SMTP_PASS: undefined });
    expect(isEmailConfigured()).toBe(false);
  });

  it("isEmailConfigured = false bez From i domain", () => {
    stubSmtp({ EMAIL_DOMAIN: undefined, EMAIL_FROM: undefined });
    expect(isEmailConfigured()).toBe(false);
  });

  it("getSmtpPort domyślnie 587", () => {
    stubSmtp({ SMTP_PORT: undefined });
    expect(getSmtpPort()).toBe(587);
  });

  it("getSmtpSecure domyślnie false", () => {
    stubSmtp({ SMTP_SECURE: undefined });
    expect(getSmtpSecure()).toBe(false);
  });

  it("getSmtpSecure true przy SMTP_SECURE=true", () => {
    stubSmtp({ SMTP_SECURE: "true" });
    expect(getSmtpSecure()).toBe(true);
  });

  it("getDefaultSenderAddress składa local@EMAIL_DOMAIN", () => {
    stubSmtp({ EMAIL_FROM: undefined });
    expect(getDefaultSenderAddress()).toBe("OnTime@ontime.mikran.pl");
    expect(getEmailFromAddress()).toBe("OnTime <OnTime@ontime.mikran.pl>");
  });

  it("getDefaultSenderAddress bez domeny zwraca pusty string (bez sandbox)", () => {
    stubSmtp({ EMAIL_DOMAIN: undefined, EMAIL_FROM: undefined });
    expect(getDefaultSenderAddress()).toBe("");
  });

  it("getEmailOverrideTo czyta EMAIL_OVERRIDE_TO", () => {
    stubSmtp();
    vi.stubEnv("EMAIL_OVERRIDE_TO", "tester@mikran.com");
    expect(getEmailOverrideTo()).toBe("tester@mikran.com");
  });
});
