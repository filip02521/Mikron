import { describe, expect, it } from "vitest";
import { redactTransactionalEmailForLog } from "./transactional-email-log";

describe("redactTransactionalEmailForLog", () => {
  it("redaguje 6-cyfrowy kod OTP w temacie i HTML", () => {
    const res = redactTransactionalEmailForLog(
      "password_reset_otp",
      "Kod resetu hasła: 123456",
      "<div>123456</div><p>ważny 15 minut</p>"
    );
    expect(res.subject).toBe("Kod resetu hasła: ••••••");
    expect(res.html).toContain("••••••");
    expect(res.html).not.toContain("123456");
  });

  it("nie zmienia innych typów maili", () => {
    const res = redactTransactionalEmailForLog(
      "delivery",
      "Dostawa 123456",
      "<p>SKU 123456</p>"
    );
    expect(res.subject).toBe("Dostawa 123456");
    expect(res.html).toBe("<p>SKU 123456</p>");
  });
});
