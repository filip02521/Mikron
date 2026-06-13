import { describe, expect, it } from "vitest";
import { renderPasswordResetOtpEmail } from "@/lib/email/password-reset-email";

describe("renderPasswordResetOtpEmail", () => {
  it("zawiera kod i tytuł resetu", () => {
    const { subject, html } = renderPasswordResetOtpEmail({
      recipientName: "Jan Kowalski",
      code: "123456",
      validMinutes: 10,
    });

    expect(subject).toContain("123456");
    expect(html).toContain("123456");
    expect(html).toContain("Reset hasła");
    expect(html).toContain("Jan Kowalski");
  });
});
