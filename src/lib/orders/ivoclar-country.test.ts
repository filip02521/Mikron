import { describe, expect, it } from "vitest";
import {
  classifyPostalShape,
  czSkDiacriticsCountry,
  extractPostalFromCity,
  inferIvoclarCountry,
  matchIvoclarCity,
  parseEmailCountry,
  parsePhoneCountry,
  parseVatCountry,
} from "./ivoclar-country";

describe("classifyPostalShape", () => {
  it("rozpoznaje unikalne formaty", () => {
    expect(classifyPostalShape("00-834").shape).toBe("pl_hyphen");
    expect(classifyPostalShape("6711PD").shape).toBe("nl");
    expect(classifyPostalShape("1628 VG").shape).toBe("nl");
    expect(classifyPostalShape("LT-38281").shape).toBe("lt");
    expect(classifyPostalShape("LT94135").shape).toBe("lt");
    expect(classifyPostalShape("D11KH31").shape).toBe("ie");
    expect(classifyPostalShape("A12B345").shape).not.toBe("ie");
    expect(classifyPostalShape("934 01").shape).toBe("cz_sk_se_spaced");
    expect(classifyPostalShape("40210").shape).toBe("five_digits");
    expect(classifyPostalShape("0661").shape).toBe("four_digits");
    expect(classifyPostalShape(" 04001").shape).toBe("five_digits");
  });

  it("nie traktuje pięciu cyfr jako polskiego XX-XXX", () => {
    expect(classifyPostalShape("00834").shape).toBe("five_digits");
    expect(classifyPostalShape("00834").compact).toBe("00834");
  });
});

describe("extractPostalFromCity", () => {
  it("wyciąga kod ze śmieci w polu miasta", () => {
    expect(extractPostalFromCity("Malacky 90101")).toEqual({
      city: "Malacky",
      postal: "90101",
    });
  });

  it("nie wyciąga roku ani cyfr sklejonych z nazwą", () => {
    expect(extractPostalFromCity("Warszawa 2024")).toEqual({
      city: "Warszawa 2024",
      postal: null,
    });
    expect(extractPostalFromCity("Malacky90101")).toEqual({
      city: "Malacky90101",
      postal: null,
    });
  });

  it("wyciąga 4-cyfrowy kod z Oslo 0661", () => {
    expect(extractPostalFromCity("Oslo 0661")).toEqual({
      city: "Oslo",
      postal: "0661",
    });
  });
});

describe("sygnały pomocnicze", () => {
  it("mapuje VAT SK/CZ/NL/EL", () => {
    expect(parseVatCountry("SK 2122634888")).toEqual({ iso: "SK", hasDigits: true });
    expect(parseVatCountry("SK 2122 634 888")).toEqual({ iso: "SK", hasDigits: true });
    expect(parseVatCountry("CZ 06967779")).toEqual({ iso: "CZ", hasDigits: true });
    expect(parseVatCountry("NL 861125836B01")).toEqual({ iso: "NL", hasDigits: true });
    expect(parseVatCountry("EL 123456789")).toEqual({ iso: "GR", hasDigits: true });
    expect(parseVatCountry("NL")).toEqual({ iso: "NL", hasDigits: false });
    expect(parseVatCountry("3122003962")).toBeNull();
  });

  it("bierze kraj tylko z prefiksu + / 00", () => {
    expect(parsePhoneCountry("+47 486 14 939")).toBe("NO");
    expect(parsePhoneCountry("004212345678")).toBe("SK");
    expect(parsePhoneCountry("517 157 124")).toBeNull();
  });

  it("pomija gmail i .pl przy ccTLD", () => {
    expect(parseEmailCountry("post@dsoslo.no")).toBe("NO");
    expect(parseEmailCountry("a@gmail.com")).toBeNull();
    expect(parseEmailCountry("a@firma.pl")).toBe("PL");
  });

  it("odróżnia czeskie i słowackie znaki", () => {
    expect(czSkDiacriticsCountry("Turčianske Kľačany")).toBe("SK");
    expect(czSkDiacriticsCountry("České Budějovice")).toBe("CZ");
    expect(czSkDiacriticsCountry("Žilina")).toBeNull();
  });
});

describe("matchIvoclarCity", () => {
  it("trafia dokładne i contains (Dublin w dłuższym adresie)", () => {
    expect(matchIvoclarCity("Oslo")?.country).toBe("NO");
    expect(matchIvoclarCity("Düsseldorf")?.country).toBe("DE");
    expect(matchIvoclarCity("Ballyboggan Road Dublin 11")?.country).toBe("IE");
    expect(matchIvoclarCity("Uherské Hradiště")?.country).toBe("CZ");
    expect(matchIvoclarCity("Malacky")?.country).toBe("SK");
  });

  it("nie zgaduje z krótkiego Ede wewnątrz innego słowa", () => {
    expect(matchIvoclarCity("Frederick")?.country).not.toBe("NL");
    expect(matchIvoclarCity("Ede")?.country).toBe("NL");
  });

  it("Halle jest niejednoznaczne (DE vs BE) do czasu kodu pocztowego", () => {
    expect(matchIvoclarCity("Halle")?.countries).toEqual(["BE", "DE"]);
    expect(matchIvoclarCity("Halle")?.country).toBeNull();
  });
});

describe("inferIvoclarCountry — żywe FS 10–16.08.2026", () => {
  it("PL z XX-XXX, nie z luki API", () => {
    const r = inferIvoclarCountry({ postal: "00-834", city: "Warszawa", nip: "9522257027" });
    expect(r.country).toBe("PL");
    expect(r.source).toBe("postal_format");
    expect(r.confidence).toBe("high");
    expect(r.postalForFile).toBe("00-834");
    expect(r.conflict).toBe(false);
  });

  it("nie stawia PL na pięciu cyfrach CZ/SK/DE", () => {
    expect(
      inferIvoclarCountry({ postal: "40210", city: "Düsseldorf" }).country
    ).toBe("DE");
    expect(
      inferIvoclarCountry({ postal: "45881", city: "Gelsenkirchen" }).country
    ).toBe("DE");
    expect(
      inferIvoclarCountry({ postal: "74601", city: "Opava" }).country
    ).toBe("CZ");
    expect(
      inferIvoclarCountry({ postal: "58601", city: "Jihlava", nip: "08890218" }).country
    ).toBe("CZ");
    expect(
      inferIvoclarCountry({
        postal: "68601",
        city: "Uherské Hradiště",
        nip: "CZ 06967779",
      }).country
    ).toBe("CZ");
    expect(
      inferIvoclarCountry({ postal: "01008", city: "Žilina", nip: "SK 2122080312" }).country
    ).toBe("SK");
    expect(
      inferIvoclarCountry({ postal: " 04001", city: "Kosice", nip: "SK 2022391591" }).country
    ).toBe("SK");
    expect(
      inferIvoclarCountry({ postal: "73991", city: "Bocanovice" }).country
    ).toBe("CZ");
    expect(
      inferIvoclarCountry({ postal: "93028", city: "Okoč-Opatovský Sokolec" }).country
    ).toBe("SK");
  });

  it("SK z NNN NN i VAT", () => {
    expect(
      inferIvoclarCountry({ postal: "949 11", city: "Nitra", nip: "SK 2122634888" })
    ).toMatchObject({ country: "SK", postalForFile: "949 11" });
    expect(
      inferIvoclarCountry({ postal: "934 01", city: "Levice" }).country
    ).toBe("SK");
  });

  it("NL / LT / IE / AT / BE / NO z formatu albo miasta", () => {
    expect(inferIvoclarCountry({ postal: "6711PD", city: "Ede", nip: "NL" }).country).toBe(
      "NL"
    );
    expect(inferIvoclarCountry({ postal: "1628 VG", city: "HOORN" }).country).toBe("NL");
    expect(inferIvoclarCountry({ postal: "5656 AE", city: "Eindhoven" }).country).toBe(
      "NL"
    );
    expect(inferIvoclarCountry({ postal: "LT-38281", city: "Linkaučiai" }).country).toBe(
      "LT"
    );
    expect(inferIvoclarCountry({ postal: "LT94135", city: "Klaipeda" }).country).toBe("LT");
    expect(
      inferIvoclarCountry({
        postal: "D11KH31",
        city: "Ballyboggan Road Dublin 11",
      }).country
    ).toBe("IE");
    expect(inferIvoclarCountry({ postal: "8502", city: "Lannach" }).country).toBe("AT");
    expect(inferIvoclarCountry({ postal: "2300", city: "Turnhout" }).country).toBe("BE");
    expect(
      inferIvoclarCountry({
        postal: "0661",
        city: "Oslo",
        phone: "+47 486 14 939",
        email: "post@dsoslo.no",
      }).country
    ).toBe("NO");
  });

  it("wyciąga SK z miasta Malacky 90101 gdy kod pusty", () => {
    const r = inferIvoclarCountry({ postal: "", city: "Malacky 90101" });
    expect(r.extractedPostalFromCity).toBe("90101");
    expect(r.country).toBe("SK");
    expect(r.postalForFile).toBe("901 01");
  });

  it("telefon +47 wystarcza przy 4 cyfrach bez miasta", () => {
    expect(inferIvoclarCountry({ postal: "0661", phone: "+47 48614939" }).country).toBe(
      "NO"
    );
  });

  it("pięć cyfr + Warszawa to PL z myślnikiem; samo 00834 nie", () => {
    const withCity = inferIvoclarCountry({ postal: "00834", city: "Warszawa" });
    expect(withCity.country).toBe("PL");
    expect(withCity.source).toBe("city");
    expect(withCity.postalForFile).toBe("00-834");
    expect(inferIvoclarCountry({ postal: "00834" }).country).toBeNull();
  });

  it("nie używa 10-cyfrowego NIP-u jako Polski", () => {
    expect(
      inferIvoclarCountry({ postal: "06401", city: "Stará Ľubovňa", nip: "3122003962" })
        .country
    ).toBe("SK");
  });

  it("e-mail .pl nie robi z 5 cyfr Polski", () => {
    expect(
      inferIvoclarCountry({ postal: "40210", city: "Düsseldorf", email: "a@firma.pl" })
        .country
    ).toBe("DE");
    expect(inferIvoclarCountry({ postal: "40210", email: "a@firma.pl" }).country).toBeNull();
  });

  it("adres wygrywa z polskim telefonem (właściciel vs lokalizacja)", () => {
    expect(
      inferIvoclarCountry({ postal: "0661", city: "Oslo", phone: "+48 500 000 000" }).country
    ).toBe("NO");
  });

  it("sprzeczność XX-XXX vs obce miasto", () => {
    const r = inferIvoclarCountry({ postal: "00-834", city: "Düsseldorf" });
    expect(r.conflict).toBe(true);
    expect(r.country).toBeNull();
    expect(r.conflictCountries).toEqual(["DE", "PL"]);
  });

  it("PARAGON bez danych zostaje pusty", () => {
    const r = inferIvoclarCountry({ postal: "", city: "", nip: "" });
    expect(r.country).toBeNull();
    expect(r.postalShape).toBe("empty");
  });

  it("Halle + 5 cyfr to DE, Halle + 4 cyfry to BE", () => {
    expect(inferIvoclarCountry({ postal: "06108", city: "Halle" }).country).toBe("DE");
    expect(inferIvoclarCountry({ postal: "1500", city: "Halle" }).country).toBe("BE");
  });

  it("Baden AT/CH bez dodatkowego sygnału zostaje puste", () => {
    const r = inferIvoclarCountry({ postal: "2500", city: "Baden" });
    expect(r.country).toBeNull();
    expect(r.conflict).toBe(false);
  });

  it("normalizuje NL i LT do zapisu pliku", () => {
    expect(inferIvoclarCountry({ postal: "6711pd", city: "Ede" }).postalForFile).toBe(
      "6711 PD"
    );
    expect(inferIvoclarCountry({ postal: "LT94135", city: "Klaipeda" }).postalForFile).toBe(
      "LT-94135"
    );
  });
});
