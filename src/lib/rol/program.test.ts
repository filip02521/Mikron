import { describe, expect, it } from "vitest";
import { applyKontrahentToRolInput, type RolProgramInput } from "./program";
import type { SubiektKontrahent } from "@/lib/subiekt/types";

const empty: RolProgramInput = {
  id: null,
  label: "",
  fileLabel: "",
  khIds: "",
  discountPct: "25",
  addressLines: "",
  nip: "",
  toEmails: "",
  ccEmails: "",
  active: true,
  reportFrequency: "month",
};

const kh: SubiektKontrahent = {
  kh_Id: 4321,
  adr_Nazwa: " Przykładowa Dental ",
  adr_NazwaPelna: "Przykładowa Dental Sp. z o.o.",
  adr_Adres: "Testowa 1/2",
  adr_Ulica: "Testowa",
  adr_Kod: "00-001",
  adr_Miejscowosc: "Miasto",
  adr_NIP: "123-456-32-18",
};

describe("applyKontrahentToRolInput", () => {
  it("nowy klient: nazwa, kartoteka, adres (ulica z numerem) i NIP z Subiekta", () => {
    const { form, filled } = applyKontrahentToRolInput(empty, kh);
    expect(form).toMatchObject({
      label: "Przykładowa Dental",
      khIds: "4321",
      addressLines: "Testowa 1/2\n00-001 Miasto",
      nip: "123-456-32-18",
      discountPct: "25",
    });
    expect(filled).toEqual(["kartoteka 4321", "nazwa", "adres", "NIP"]);
  });

  it("druga kartoteka istniejącego klienta: dopisuje kh_Id, nie nadpisuje wpisanych pól", () => {
    const current = { ...empty, label: "Przykładowa", khIds: "111", addressLines: "ul. Inna 5", nip: "9999999999" };
    const { form, filled } = applyKontrahentToRolInput(current, kh);
    expect(form).toMatchObject({ label: "Przykładowa", khIds: "111, 4321", addressLines: "ul. Inna 5", nip: "9999999999" });
    expect(filled).toEqual(["kartoteka 4321"]);
  });

  it("ta sama kartoteka drugi raz: nic się nie zmienia", () => {
    const once = applyKontrahentToRolInput(empty, kh).form;
    expect(applyKontrahentToRolInput(once, kh)).toEqual({ form: once, filled: [] });
  });

  it("brak skróconej nazwy i adresu z numerem → pełna nazwa i sama ulica; puste pola pomija", () => {
    const { form } = applyKontrahentToRolInput(empty, { kh_Id: 7, adr_NazwaPelna: "Gabinet Kowalski", adr_Ulica: "Polna", adr_Miejscowosc: "Wieś" });
    expect(form).toMatchObject({ label: "Gabinet Kowalski", khIds: "7", addressLines: "Polna\nWieś", nip: "" });
  });
});
