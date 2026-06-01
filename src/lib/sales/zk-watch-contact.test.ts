import { describe, expect, it } from "vitest";
import { extractZkWatchClientContact, normalizePhoneHref } from "./zk-watch-contact";
import type { SalesZkWatch } from "@/types/database";

const baseWatch: SalesZkWatch = {
  id: "w1",
  sales_person_id: "sp1",
  subiekt_dok_id: 1,
  zk_number: "ZK/1",
  client_label: "Klient",
  client_kh_id: 42,
  amount_net: null,
  amount_gross: null,
  zk_issued_at: null,
  note: null,
  line_summary: null,
  line_checks: [],
  subiekt_snapshot: {
    kh__Kontrahent_Odbiorca: {
      kh_Id: 42,
      kh_EMail: " biuro@klinika.pl ",
      adr_Telefon: "601 111 222",
    },
  },
  follow_up_at: null,
  closed_at: null,
  archived_at: null,
  created_at: "",
  updated_at: "",
};

describe("extractZkWatchClientContact", () => {
  it("czyści e-mail i telefon ze snapshotu", () => {
    expect(extractZkWatchClientContact(baseWatch)).toEqual({
      email: "biuro@klinika.pl",
      phone: "601 111 222",
    });
  });

  it("zwraca puste kontakty bez snapshotu", () => {
    expect(
      extractZkWatchClientContact({ ...baseWatch, subiekt_snapshot: null })
    ).toEqual({
      email: null,
      phone: null,
    });
  });
});

describe("normalizePhoneHref", () => {
  it("dodaje +48 dla 9 cyfr", () => {
    expect(normalizePhoneHref("601111222")).toBe("tel:+48601111222");
  });
});
