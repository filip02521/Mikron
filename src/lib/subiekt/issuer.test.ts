import { describe, expect, it } from "vitest";
import { matchSubiektUserByEmail } from "./issuer";

// Osoby fikcyjne (repo jest publiczne) — kształt danych jak z GET /uzytkownicy.
const users = [
  { uz_Id: 1, uz_Imie: "Szef", uz_Nazwisko: "" },
  { uz_Id: 22, uz_Imie: "Aleksandra", uz_Nazwisko: "Wróbel" },
  { uz_Id: 38, uz_Imie: "Kasia", uz_Nazwisko: "Lis" },
  { uz_Id: 44, uz_Imie: "Aleksandra", uz_Nazwisko: "Żółkiewska" },
  { uz_Id: 59, uz_Imie: "Tomasz", uz_Nazwisko: "Kowal" },
  { uz_Id: 50, uz_Imie: "Inna", uz_Nazwisko: "Kowal" },
  { uz_Id: 85, uz_Imie: "Jan", uz_Nazwisko: "Nowak" },
];

describe("matchSubiektUserByEmail", () => {
  it("imię i nazwisko z adresu, bez ogonków", () => {
    expect(matchSubiektUserByEmail("jan.nowak@mikran.com", users)?.uz_Id).toBe(85);
    expect(matchSubiektUserByEmail("aleksandra.zolkiewska@mikran.com", users)?.uz_Id).toBe(44);
    expect(matchSubiektUserByEmail("kasia.lis@mikran.com", users)?.uz_Id).toBe(38);
  });
  it("inne imię, jednoznaczne nazwisko → po nazwisku", () => {
    expect(matchSubiektUserByEmail("ola.wrobel@mikran.com", users)?.uz_Id).toBe(22);
  });
  it("niejednoznaczne nazwisko albo brak osoby → null (nie zgadujemy)", () => {
    expect(matchSubiektUserByEmail("piotr.kowal@mikran.com", users)).toBeNull();
    expect(matchSubiektUserByEmail("nowa.osoba@mikran.com", users)).toBeNull();
    expect(matchSubiektUserByEmail("biuro@mikran.com", users)).toBeNull();
    expect(matchSubiektUserByEmail(null, users)).toBeNull();
  });
});
