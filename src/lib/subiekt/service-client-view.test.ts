import { describe, expect, it } from "vitest";
import { serviceClientView } from "@/lib/subiekt/service-client-view";
import type { SubiektKontrahent } from "@/lib/subiekt/types";

describe("serviceClientView", () => {
  it("zostawia tylko pola przyjęcia sprzętu — bez NIP-u, e-maila, adresu i pól spoza typu", () => {
    const full = {
      kh_Id: 7,
      kh_Symbol: "GAB-1",
      kh_EMail: "biuro@example.test",
      kh_Typ: 2,
      adr_Nazwa: "Gabinet Testowy",
      adr_NazwaPelna: "Gabinet Testowy sp. z o.o.",
      adr_NIP: "0000000000",
      adr_Miejscowosc: "Testowo",
      adr_Ulica: "Prosta",
      adr_Telefon: "500 000 001",
      kh_Telefon: null,
      kh_Uwagi: "notatka",
    } as SubiektKontrahent;
    const view = serviceClientView(full);
    expect(view).toEqual({
      kh_Id: 7,
      kh_Symbol: "GAB-1",
      adr_Nazwa: "Gabinet Testowy",
      adr_NazwaPelna: "Gabinet Testowy sp. z o.o.",
      adr_Miejscowosc: "Testowo",
      adr_Telefon: "500 000 001",
      kh_Telefon: null,
    });
    expect(JSON.stringify(view)).not.toMatch(/NIP|EMail|Ulica|Uwagi|Typ/);
  });
});
