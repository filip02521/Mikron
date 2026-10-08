import { describe, expect, it } from "vitest";
import { emailsInText } from "./supplier-emails";

describe("emailsInText — adresy dostawcy z karty", () => {
  it("zwykłe adresy: małe litery, bez powtórek, w kolejności", () => {
    expect(emailsInText("Order@Renfert.de; info@renfert.de order@renfert.de")).toEqual(["order@renfert.de", "info@renfert.de"]);
  });
  it("login do portalu nie jest adresem do zamówień (przyklejony i ze spacją)", () => {
    expect(emailsInText("https://wholesale.formlabs.com login:aleksandra@firma.pl H: xyz")).toEqual([]);
    expect(emailsInText("Login: zakupy@portal.de, zamówienia: orders@portal.de")).toEqual(["orders@portal.de"]);
    expect(emailsInText("użytkownik jan@sklep.pl")).toEqual([]);
  });
  it("adresy Mikranu pomijane — zamówienie nie może pójść do nas", () => {
    expect(emailsInText("kontakt: jan.nowak@mikran.com, sales@dostawca.pl")).toEqual(["sales@dostawca.pl"]);
  });
  it("etykieta inna niż login jest odcinana, adres zostaje", () => {
    expect(emailsInText("mail:biuro@dostawca.pl")).toEqual(["biuro@dostawca.pl"]);
  });
});
