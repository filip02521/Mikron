import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMailRaw = vi.fn();

vi.mock("@/lib/services/smtp-transport", () => ({
  sendMailRaw: (...args: unknown[]) => sendMailRaw(...args),
}));

vi.mock("@/lib/services/transactional-email-log", () => ({
  recordTransactionalEmailLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/env/email-config", () => ({
  isEmailConfigured: vi.fn(() => true),
  getEmailFromAddress: vi.fn(() => "OnTime <tomek@ontime.mikran.pl>"),
  getEmailOverrideTo: vi.fn(() => process.env.EMAIL_OVERRIDE_TO?.trim() || undefined),
}));

import { isEmailConfigured } from "@/lib/env/email-config";
import {
  sendHtmlEmail,
  sendHtmlEmailWithAttachments,
} from "@/lib/services/email";

describe("email.ts (SES SMTP)", () => {
  beforeEach(() => {
    sendMailRaw.mockReset();
    sendMailRaw.mockResolvedValue({ messageId: "<msg-1@ses>" });
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    delete process.env.EMAIL_OVERRIDE_TO;
  });

  afterEach(() => {
    delete process.env.EMAIL_OVERRIDE_TO;
  });

  it("sendHtmlEmail wysyła HTML i zwraca messageId", async () => {
    const res = await sendHtmlEmail({
      to: "a@example.com",
      subject: "Temat",
      html: "<p>Hi</p>",
    });
    expect(res).toEqual({ ok: true, id: "<msg-1@ses>" });
    expect(sendMailRaw).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "a@example.com",
        subject: "Temat",
        html: "<p>Hi</p>",
        from: "OnTime <tomek@ontime.mikran.pl>",
      })
    );
  });

  it("sendHtmlEmail przy tablicy to bierze tylko pierwszy adres (parity)", async () => {
    await sendHtmlEmail({
      to: ["first@example.com", "second@example.com"],
      subject: "S",
      html: "<p>x</p>",
    });
    expect(sendMailRaw).toHaveBeenCalledWith(
      expect.objectContaining({ to: "first@example.com" })
    );
  });

  it("EMAIL_OVERRIDE_TO przekierowuje i prefixuje subject", async () => {
    process.env.EMAIL_OVERRIDE_TO = "tester@mikran.com";
    await sendHtmlEmail({
      to: "real@example.com",
      subject: "Prod",
      html: "<p>x</p>",
    });
    expect(sendMailRaw).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "tester@mikran.com",
        subject: "[TEST → real@example.com] Prod",
      })
    );
  });

  it("brak konfiguracji SMTP → ok:false bez wywołania transportu", async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(false);
    const res = await sendHtmlEmail({
      to: "a@example.com",
      subject: "S",
      html: "<p>x</p>",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/SMTP/);
    }
    expect(sendMailRaw).not.toHaveBeenCalled();
  });

  it("sendHtmlEmailWithAttachments dekoduje base64 i przekazuje CC/BCC", async () => {
    const content = Buffer.from("hello").toString("base64");
    const res = await sendHtmlEmailWithAttachments({
      to: ["a@example.com", "b@example.com"],
      cc: ["cc@example.com"],
      bcc: ["bcc@example.com"],
      subject: "Att",
      html: "<p>file</p>",
      attachments: [
        {
          filename: "x.xlsx",
          content,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });
    expect(res).toEqual({
      ok: true,
      id: "<msg-1@ses>",
      deliveredTo: ["a@example.com", "b@example.com"],
    });
    expect(sendMailRaw).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["a@example.com", "b@example.com"],
        cc: ["cc@example.com"],
        bcc: ["bcc@example.com"],
        attachments: [
          expect.objectContaining({
            filename: "x.xlsx",
            content: Buffer.from("hello"),
          }),
        ],
      })
    );
  });

  it("sendHtmlEmailWithAttachments bez TO → błąd", async () => {
    const res = await sendHtmlEmailWithAttachments({
      to: [],
      subject: "S",
      html: "<p>x</p>",
    });
    expect(res).toEqual({ ok: false, error: "Brak odbiorców TO", intendedTo: [] });
    expect(sendMailRaw).not.toHaveBeenCalled();
  });

  it("błąd transportu mapuje się na ok:false", async () => {
    sendMailRaw.mockRejectedValue(new Error("SES rejected"));
    const res = await sendHtmlEmail({
      to: "a@example.com",
      subject: "S",
      html: "<p>x</p>",
    });
    expect(res).toEqual({
      ok: false,
      error: "SES rejected",
      to: "a@example.com",
    });
  });
});
