import { describe, expect, it } from "vitest";
import { formatHelpdeskWhen, isPossibleDuplicateTicket } from "@/lib/orders/service-related-cases";

const order = { deviceName: "Mikrosilnik Marathon 600", serialNo: "ab 1234" };
const t = (product: string, status = "Nowe zgłoszenie", comment = "") => ({ product, status, comment });

describe("isPossibleDuplicateTicket", () => {
  it("open ticket with the order's serial in product or comment", () => {
    expect(isPossibleDuplicateTicket(t("Turbina S/N: AB1234"), order)).toBe(true);
    expect(isPossibleDuplicateTicket(t("Coś innego", "Przyjęte", "numer seryjny ab1234, nie działa"), order)).toBe(true);
  });

  it("open ticket with the same product name (either contains the other)", () => {
    expect(isPossibleDuplicateTicket(t("mikrosilnik marathon 600 SN XY999"), order)).toBe(true);
    expect(isPossibleDuplicateTicket(t("Marathon 600"), order)).toBe(true);
  });

  it("closed ticket is never a duplicate", () => {
    expect(isPossibleDuplicateTicket(t("Turbina S/N: AB1234", "Zakończone"), order)).toBe(false);
    expect(isPossibleDuplicateTicket(t("Marathon 600", "Zamknięte"), order)).toBe(false);
  });

  it("different device, or too short to compare", () => {
    expect(isPossibleDuplicateTicket(t("Lampa polimeryzacyjna"), order)).toBe(false);
    expect(isPossibleDuplicateTicket(t("abc"), { deviceName: "abc", serialNo: "12" })).toBe(false);
    expect(isPossibleDuplicateTicket(t("Lampa 12"), { deviceName: "Skaler", serialNo: "12" })).toBe(false);
    expect(isPossibleDuplicateTicket(t(""), order)).toBe(false);
  });
});

describe("formatHelpdeskWhen", () => {
  it("formats helpdesk dates", () => {
    expect(formatHelpdeskWhen("2026-11-05 14:32:00")).toBe("05.11.2026 14:32");
    expect(formatHelpdeskWhen("2026-11-05T00:00:00")).toBe("05.11.2026");
    expect(formatHelpdeskWhen("2026-11-05")).toBe("05.11.2026");
    expect(formatHelpdeskWhen("wczoraj")).toBe("wczoraj");
  });
});
