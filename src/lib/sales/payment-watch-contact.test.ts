import { describe, expect, it } from "vitest";
import { extractPaymentWatchClientContact, normalizePhoneHref } from "./payment-watch-contact";
import type { SalesPaymentWatch } from "@/types/database";

const baseWatch: SalesPaymentWatch = {
  id: "w1",
  sales_person_id: "sp1",
  subiekt_dok_id: 1782110,
  zk_number: "ZK 153157/M/04/2026",
  client_label: "Walczak Jacek",
  client_kh_id: 6769,
  amount_net: null,
  amount_gross: 5000,
  zk_issued_at: null,
  due_at: null,
  note: null,
  line_summary: null,
  subiekt_snapshot: {
    dok_Id: 1782110,
    kh__Kontrahent_Odbiorca: {
      kh_Id: 6769,
      kh_EMail: "  jacek@example.com ",
      adr_Telefon: "61 123 45 67",
    },
  },
  settled_at: null,
  archived_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("extractPaymentWatchClientContact", () => {
  it("czyta e-mail i telefon z embedu kontrahenta", () => {
    expect(extractPaymentWatchClientContact(baseWatch)).toEqual({
      email: "jacek@example.com",
      phone: "61 123 45 67",
    });
  });

  it("zwraca puste gdy brak snapshotu", () => {
    expect(
      extractPaymentWatchClientContact({ ...baseWatch, subiekt_snapshot: null })
    ).toEqual({ email: null, phone: null });
  });
});

describe("normalizePhoneHref", () => {
  it("buduje tel: z numerem krajowym", () => {
    expect(normalizePhoneHref("601234567")).toBe("tel:+48601234567");
    expect(normalizePhoneHref("61 123 45 67")).toBe("tel:+48611234567");
  });
});
