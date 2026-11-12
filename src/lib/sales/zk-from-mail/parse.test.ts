import { describe, expect, it } from "vitest";
import { extractQuantity, looksLikeSymbol, parseCustomerMail, wordStem } from "./parse";

const MAIL = `Od: Anna Testowa <zamowienia@przyklad-dental.pl>
Do: handlowiec@mikran.pl
Temat: zamówienie

Dzień dobry, proszę o:
- 517019 rękawice nitrylowe M – 10 op.
- wiertła diamentowe kulka 012 x 5
- 3 szt. tego samego kompozytu co ostatnio

Pozdrawiam
Anna Testowa
tel. 600 100 200
NIP: 000-000-00-00`;

describe("parseCustomerMail", () => {
  it("czyta nadawcę, NIP i linie z towarami, bez nagłówków i podpisu", () => {
    const parsed = parseCustomerMail(MAIL);
    expect(parsed.senderEmail).toBe("zamowienia@przyklad-dental.pl");
    expect(parsed.nip).toBe("0000000000");
    expect(parsed.lines.map((l) => [l.quantity, l.symbols])).toEqual([
      [10, ["517019"]],
      [5, []],
      [3, []],
    ]);
    expect(parsed.lines[1]!.nameStems).toEqual(["wiert", "diamen", "kulka"]);
    expect(parsed.lines[2]!.nameStems).toEqual(["kompoz"]);
  });

  it("w przekazanym mailu pomija adres firmy i bierze klienta", () => {
    const parsed = parseCustomerMail("Od: Jan Handlowy <jan.handlowy@mikran.pl>\n---\nFrom: biuro@gabinet-wymyslony.pl\nGIPS-25 2 szt");
    expect(parsed.senderEmail).toBe("biuro@gabinet-wymyslony.pl");
    expect(parsed.lines).toHaveLength(1);
  });

  it("linia bez ilości z symbolem zostaje, ilość pusta", () => {
    const parsed = parseCustomerMail("Proszę jeszcze AB-1234");
    expect(parsed.lines).toEqual([{ text: "Proszę jeszcze AB-1234", quantity: null, symbols: ["AB-1234"], nameStems: [], hints: [] }]);
  });

  it("zatrzymuje się na cytacie poprzedniej wiadomości", () => {
    const parsed = parseCustomerMail("2 szt 517019\nW dniu 10.11.2026 Jan napisał:\n5 szt 999999");
    expect(parsed.lines.map((l) => l.symbols[0])).toEqual(["517019"]);
  });

  it("przekazany łańcuch: klient z najgłębszego Od:, zamówienie z cytatu, bez kodu pocztowego", () => {
    const fwd = `Zosiu, zrealizuj proszę
--
Jan Wymyślony
------ Wiadomość przekazana dalej ------
Od: Dostawca Wymyślony <handel@dostawca-wymyslony.example>
Temat: Re: zamówienie
> Można sprzedać ze stanu.
> W dniu pon. Jan napisał(a):
>> ------ Wiadomość przekazana dalej ------
>> Od: Ewa Klientka <ewa@szkola-wymyslona.example>
>> Temat: zamówienie
>>
>> zgodnie z Państwa ofertą zamawiam:
>> 1 szt. - Drukarka 3D Form 4B – w cenie 21 138,21 zł netto/szt.
>> Adres dostawy: ul. Wymyślona 1, 31-024 Kraków
>> Zamawialiśmy je w zeszłym roku (faktura nr 2859/M/05/2025)
>> Pozdrawiam`;
    const parsed = parseCustomerMail(fwd);
    expect(parsed.senderEmail).toBe("ewa@szkola-wymyslona.example");
    expect(parsed.lines.map((l) => [l.quantity, l.symbols])).toEqual([[1, []]]);
    expect(parsed.lines[0]!.nameStems.slice(0, 3)).toEqual(["drukar", "form"]);
  });

  it("wstęp listy z dwukropkiem dopowiada nazwę, kod rozmiaru idzie do wyszukiwania", () => {
    const parsed = parseCustomerMail("Chciałabym zamówić zęby z Majora Super Lux:\nkolor A1 rozmiar A33 góra - 17 sztuk,\nkolor A3,5 rozmiar A33 dół - 5 sztuk.");
    expect(parsed.lines.map((l) => [l.quantity, l.nameStems])).toEqual([
      [17, ["a33", "major", "super", "lux"]],
      [5, ["a33", "major", "super", "lux"]],
    ]);
  });

  it("odpowiedź z Outlooka: zamówienie nad cytatem, nasza oferta pod Original Message nie jest czytana", () => {
    const reply = `Dzień dobry, biorę 3 szt. AB-1234
NIP: PL1234567890
-----Original Message-----
From: Jan Handlowy <jan.handlowy@mikran.com>
Sent: Monday
Oferta: 5 szt. ZZ-9999 w cenie 10 zł
NIP: PL9999999999`;
    const parsed = parseCustomerMail(reply);
    expect(parsed.lines.map((l) => l.symbols)).toEqual([["AB-1234"]]);
    expect(parsed.nip).toBe("1234567890");
  });

  it("w przekazanym mailu NIP ze stopki kolegi nad przekazaniem się nie liczy", () => {
    const fwd = `Zrealizuj proszę
Jan Handlowy
NIP: PL9999999999
---------- Forwarded message ---------
Od: Ewa Klientka <ewa@gabinet-wymyslony.example>
2 szt. AB-1234
Pozdrawiam`;
    const parsed = parseCustomerMail(fwd);
    expect(parsed.senderEmail).toBe("ewa@gabinet-wymyslony.example");
    expect(parsed.nip).toBeNull();
  });

  it("„Do tego” i „To samo” to treść, nie nagłówek; linia NIP bez dwukropka nie jest pozycją", () => {
    const parsed = parseCustomerMail("Do tego 2 szt. AB-1234\nTo samo co wcześniej CD-5678 x 3\nNIP 1234567890");
    expect(parsed.lines.map((l) => [l.quantity, l.symbols])).toEqual([
      [2, ["AB-1234"]],
      [3, ["CD-5678"]],
    ]);
  });

  it("przekazanie z Apple Mail i symbol z ukośnikami", () => {
    const parsed = parseCustomerMail("Początek przekazywanej wiadomości:\nOd: Ewa <ewa@gabinet-wymyslony.example>\nMikrosilnik 207B/210/90N - 1 szt.");
    expect(parsed.senderEmail).toBe("ewa@gabinet-wymyslony.example");
    expect(parsed.lines[0]!.symbols).toEqual(["207B/210/90N"]);
  });

  it("tylko adres Mikranu = brak nadawcy, ale z informacją dlaczego", () => {
    const parsed = parseCustomerMail("Od: Jan Handlowy <jan.handlowy@mikran.com>\n2 szt. AB-1234");
    expect(parsed).toMatchObject({ senderEmail: null, onlyOwnSender: true });
  });

  it("pusty tekst = brak linii", () => {
    expect(parseCustomerMail("")).toEqual({ senderEmail: null, onlyOwnSender: false, nip: null, lines: [] });
  });
});

describe("extractQuantity", () => {
  it.each([
    ["rękawice 10 op.", 10],
    ["3 szt. kompozytu", 3],
    ["kulka 012 x 5", 5],
    ["5x frez", 5],
    ["ilość: 2 wiertła", 2],
    ["gips – 4", 4],
    ["1,5 kg", null],
    ["517019 rękawice", null],
  ])("%s → %s", (line, qty) => {
    expect(extractQuantity(line).quantity).toBe(qty);
  });
});

describe("looksLikeSymbol / wordStem", () => {
  it("symbol z cyfrą, nie rozmiar", () => {
    expect(["517019", "WD-K012", "772-517-00", "AB12"].every(looksLikeSymbol)).toBe(true);
    expect(["012", "5/16", "M", "1,5", "kulka", "31-024", "2859/M/05/2025", "05.11.2026"].some(looksLikeSymbol)).toBe(false);
  });

  it("rdzeń ucina końcówkę odmiany", () => {
    expect(wordStem("kompozytu")).toBe("kompoz");
    expect(wordStem("gips")).toBe("gips");
  });
});
