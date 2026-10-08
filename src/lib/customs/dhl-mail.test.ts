import { describe, expect, it } from "vitest";
import {
  classifyDhlMail,
  dhlInvoiceAttachments,
  dhlMailNeedsBody,
  dhlTicketDate,
  isCustomsRelease,
  matchSupplierBySellerName,
  nextStage,
  stripSubjectPrefixes,
} from "./dhl-mail";

const DHL = "odprawacelna@dhl.com";
const US = "Jan Nowak <jan.nowak@example.com>";

describe("classifyDhlMail", () => {
  it("prośba z numerem sprawy", () => {
    const m = classifyDhlMail({
      subject: "T#1PO2608110000295 - Agencja Celna DHL - przesyłka numer: 6629295002",
      from: DHL,
      snippet: "Please scroll down for the English version. W celu zachowania ciągłości korespondencji…",
    });
    expect(m).toMatchObject({ kind: "request", awb: "6629295002", ticket: "1PO2608110000295", forwarded: false });
  });

  it("przekazana prośba to ta sama przesyłka (forwarded)", () => {
    const m = classifyDhlMail({
      subject: "Fwd: T#1PO2608110000295 - Agencja Celna DHL - przesyłka numer: 6629295002",
      from: US,
      snippet: "Pozdrawiam ------",
    });
    expect(m).toMatchObject({ kind: "request", awb: "6629295002", forwarded: true });
  });

  it("ponaglenie i potwierdzenie (temat bez T#)", () => {
    expect(
      classifyDhlMail({
        subject: "Agencja Celna DHL - przesyłka numer: 5581791541",
        from: DHL,
        snippet: "Szanowny Kliencie, prosimy o odpowiedź na wcześniej wysłaną wiadomość",
      })?.kind
    ).toBe("reminder");
    expect(
      classifyDhlMail({
        subject: "Agencja Celna DHL - przesyłka numer: 4277802152",
        from: DHL,
        snippet: "Szanowny Kliencie, dziękujemy za dyspozycję do zgłoszenia celnego",
      })?.kind
    ).toBe("confirmation");
  });

  it("przekazana kopia bez treści we fragmencie → doczytać całość", () => {
    const subject = "Fwd: Agencja Celna DHL - przesyłka numer: 5581791541";
    expect(classifyDhlMail({ subject, from: US, snippet: "---------- Forwarded message --------- Od: odprawacelna@dhl.com" })).toBeNull();
    expect(dhlMailNeedsBody(subject)).toBe(true);
    expect(dhlMailNeedsBody("Fwd: T#1PO2608110000295 - Agencja Celna DHL - przesyłka numer: 6629295002")).toBe(false);
  });

  it("data sprawy z numeru T#", () => {
    expect(dhlTicketDate("1PO2604030000040")).toBe("2026-04-03T06:00:00.000Z");
    expect(dhlTicketDate("1PO2513400000040")).toBeNull();
    expect(dhlTicketDate(null)).toBeNull();
  });

  it("przekazane ponaglenie rozpoznaje po nagłówku przekazania", () => {
    const m = classifyDhlMail({
      subject: "Fwd: Agencja Celna DHL - przesyłka numer: 5581791541",
      from: US,
      snippet:
        "---------- Forwarded message --------- Od: odprawacelna@dhl.com &lt;odprawacelna@dhl.com&gt; Date: … prosimy o odpowiedź na wcześniej",
    });
    expect(m).toMatchObject({ kind: "reminder", forwarded: true });
  });

  it("potwierdzenie w starszym brzmieniu (2025) i mail agencji bez T# to nie nowa prośba", () => {
    const subject = "Agencja Celna DHL - przesyłka numer: 1418916531";
    expect(
      classifyDhlMail({ subject, from: DHL, snippet: "PL:Szanowny Kliencie, Dziękuję za dyspozycję do zgłoszenia celnego" })?.kind
    ).toBe("confirmation");
    expect(classifyDhlMail({ subject, from: DHL, snippet: "Szanowny Kliencie, w nawiązaniu do przesyłki" })?.kind).toBe("agency");
  });

  it("pytanie agencji i nasza odpowiedź w wątku [T#…]", () => {
    const subject = "Re: [T#1PO2609290000075] - Agencja Celna DHL - przesyłka numer: 4277802152";
    expect(classifyDhlMail({ subject, from: DHL, snippet: "Proszę o przesłanie faktury" })).toMatchObject({
      kind: "agency",
      ticket: "1PO2609290000075",
    });
    expect(
      classifyDhlMail({ subject, from: US, to: "odprawacelna@dhl.com", snippet: "W załączniku przesyłam fakturę." })?.kind
    ).toBe("replied");
  });

  it("komunikaty celne z MRN", () => {
    const m = classifyDhlMail({
      subject: "Powiadomienie o odebranym komunikacie ZC429 - dot. AWB 4931231060 26PL44302D00PTUUR7",
      from: "plpozecs@dhl.com",
      snippet: "",
    });
    expect(m).toMatchObject({ kind: "customs", awb: "4931231060", customsCode: "ZC429", mrn: "26PL44302D00PTUUR7" });
    expect(isCustomsRelease("ZC429")).toBe(true);
    expect(isCustomsRelease("PW429")).toBe(false);
    expect(isCustomsRelease("ZCX91")).toBe(false);
  });

  it("cło do zapłaty i pokwitowanie (AWB z treści)", () => {
    expect(
      classifyDhlMail({
        subject: "Powiadomienie o należnym cle przywozowym/podatku",
        from: "ADCPL@dhl.com",
        snippet: "WYMAGANE JEST OPŁACENIE CŁA PRZYWOZOWEGO/PODATKU … o numerze listu przewozowego 6629295002",
      })
    ).toMatchObject({ kind: "duties", awb: "6629295002" });
    expect(
      classifyDhlMail({
        subject: "Pokwitowanie płatności DHL Express",
        from: "ADCPL@dhl.com",
        snippet: "POTWIERDZENIE PŁATNOŚCI … numerze listu przewozowego 6629295002",
      })?.kind
    ).toBe("paid");
  });

  it("rozmowa wewnętrzna / z dostawcą w wątku T# to nie odpowiedź do agencji ani pytanie agencji", () => {
    const subject = "Re: Fwd: T#1PO2607310000055 - Agencja Celna DHL - przesyłka numer: 1092134455";
    expect(classifyDhlMail({ subject, from: "Daisy <sales@supplier.example>", to: "jan.nowak@example.com", snippet: "Hello" })).toBeNull();
    // „Re: T#…” do koleżanki, bez DHL w adresatach.
    expect(
      classifyDhlMail({
        subject: "Re: T#1PO2607310000055 - Agencja Celna DHL - przesyłka numer: 1092134455",
        from: US,
        to: "anna.kowalska@example.com",
        snippet: "Odpisałam im już",
      })
    ).toBeNull();
  });

  it("autoodpowiedź DHL na naszą odpowiedź — tylko numer sprawy", () => {
    expect(
      classifyDhlMail({
        subject: "[T#1PO2609290000075] Automatyczna Odpowiedź",
        from: '"no-reply@dhl.com" <no-reply@dhl.com>',
        snippet: "Dzień dobry, dziękujemy za przesłaną wiadomość.",
      })
    ).toMatchObject({ kind: "replied", awb: null, ticket: "1PO2609290000075" });
  });

  it("starszy format ponaglenia (półpauza) przekazany dalej", () => {
    expect(
      classifyDhlMail({
        subject: "Fwd: Agencja Celna DHL – prosimy o odpowiedź do przesyłki o numerze: 7363753250",
        from: US,
        snippet: "Pozdrawiam ------",
      })
    ).toMatchObject({ kind: "reminder", awb: "7363753250", forwarded: true });
  });

  it("starszy format zwolnienia: kod z nazwy załącznika, MRN z tematu", () => {
    const subject = "Powiadomienie o dokonanej odprawie importowej do przesylki o numerze 5783384762-(25PL39101D0025VIR8)";
    expect(
      classifyDhlMail({ subject, from: "plpozecs@dhl.com", snippet: "", attachmentNames: ["ZC429_25PL39101D0025VIR8_1_PL.pdf"] })
    ).toMatchObject({ kind: "customs", awb: "5783384762", customsCode: "ZC429", mrn: "25PL39101D0025VIR8" });
    expect(
      classifyDhlMail({
        subject: "Fwd: Powiadomienie o dokonanej odprawie importowej do przesylki o numerze 5111543194-(25PL39101D000E2UN3)",
        from: US,
        snippet: "---------- Forwarded message --------- Od: Agencja Celna DHL POZ <plpozecs@dhl.com>",
        attachmentNames: ["PW429_25PL39101D000E2UN3_1_PL.pdf"],
      })
    ).toMatchObject({ customsCode: "PW429", forwarded: true });
  });

  it("przedpłata: wezwanie agencji = cło do zapłaty, nasza odpowiedź z przelewem = zapłacone", () => {
    const subject = "PRZEDPŁATA należności celno-podatkowych dot. AWB: 9489286004";
    expect(classifyDhlMail({ subject, from: "plpozecs@dhl.com", snippet: "Szanowni Państwo" })).toMatchObject({
      kind: "duties",
      awb: "9489286004",
    });
    expect(
      classifyDhlMail({ subject: `Re: ${subject}`, from: US, to: "plpozecs@dhl.com", snippet: "W załączeniu przesyłam potwierdzenie przelewu." })
        ?.kind
    ).toBe("paid");
  });

  it("pokwitowanie opłacenia (starszy temat) i doręczenie", () => {
    expect(
      classifyDhlMail({
        subject: "Pokwitowanie opłacenia cła przywozowego/podatku",
        from: "ADCPL@dhl.com",
        snippet: "POTWIERDZENIE PŁATNOŚCI Dziękujemy za dokonanie płatności za przesyłkę DHL Express o numerze listu przewozowego 5111543194",
      })
    ).toMatchObject({ kind: "paid", awb: "5111543194" });
    expect(
      classifyDhlMail({
        subject: "DHL On Demand Delivery",
        from: "NoReply.ODD@dhl.com",
        snippet: "Polski | English DORĘCZONO! Drogi Kliencie, Twoja przesyłka DHL Express 1092134455 o numerze listu przewozowego 1092134455",
      })
    ).toMatchObject({ kind: "delivered", awb: "1092134455" });
    expect(
      classifyDhlMail({ subject: "DHL On Demand Delivery", from: "NoReply.ODD@dhl.com", snippet: "TWOJA PRZESYŁKA JEST W DRODZE" })
    ).toBeNull();
  });

  it("przekazane „należnym cle” bez numeru we fragmencie — wymaga doczytania treści", () => {
    const subject = "Fwd: Powiadomienie o należnym cle przywozowym/podatku";
    expect(classifyDhlMail({ subject, from: US, snippet: "Hejka, cło jest do opłacenia :)" })).toBeNull();
    expect(dhlMailNeedsBody(subject)).toBe(true);
    expect(
      classifyDhlMail({ subject, from: US, snippet: "Hejka\n---------- Forwarded message ---------\nOd: DHL Express <ADCPL@dhl.com>\nTwoja przesyłka DHL Express o numerze listu przewozowego 6629295002" })
    ).toMatchObject({ kind: "duties", awb: "6629295002" });
    expect(dhlMailNeedsBody("Re: T#1 - Agencja Celna DHL - przesyłka numer: 1234567890")).toBe(false);
  });

  it("inne maile → null", () => {
    expect(classifyDhlMail({ subject: "Oferta DHL Express", from: "news@dhl.com", snippet: "" })).toBeNull();
  });
});

describe("stripSubjectPrefixes", () => {
  it("zdejmuje zagnieżdżone Re/Fwd", () => {
    expect(stripSubjectPrefixes("RE: Fwd: PD: Temat")).toEqual({ subject: "Temat", forwarded: true, reply: true });
  });
});

describe("dhlInvoiceAttachments", () => {
  it("wszystkie pliki INV (PDF i TIFF, dowolna wielkość liter), bez listu przewozowego", () => {
    const files = [
      { filename: "6629295002.AWB.SKT.GTW.A3Y.20260811.141515.pdf" },
      { filename: "6629295002.INV.SKT.GTW.L90.20260811.141543.pdf" },
      { filename: "6629295002.INV.SKT.GTW.001.20260811.203304.pdf" },
      { filename: "TemplateHeader.png" },
    ];
    expect(dhlInvoiceAttachments(files, "6629295002").map((f) => f.filename)).toEqual([
      "6629295002.INV.SKT.GTW.001.20260811.203304.pdf",
      "6629295002.INV.SKT.GTW.L90.20260811.141543.pdf",
    ]);
    expect(
      dhlInvoiceAttachments(
        [{ filename: "7603442523.awb.hkg.hkc.57t.20250721.141123.tif" }, { filename: "7603442523.inv.hkg.hkc.7h6.20250721.141133.tif" }],
        "7603442523"
      ).map((f) => f.filename)
    ).toEqual(["7603442523.inv.hkg.hkc.7h6.20250721.141133.tif"]);
    expect(dhlInvoiceAttachments([{ filename: "TemplateHeader.png" }, { filename: "CI_260327XIN.pdf" }], "1")).toEqual([]);
  });
});

describe("matchSupplierBySellerName", () => {
  const suppliers = [
    { id: "up3d", name: "Up3D" },
    { id: "saeshin", name: "Saeshin" },
    { id: "runyes", name: "Runyes" },
    { id: "upcera", name: "Shenzen Upcera" },
    { id: "song", name: "Song Young" },
    { id: "aswad", name: "Aswad Instruments" },
  ];
  it("rozpoznaje mimo formy prawnej, miasta i literówek", () => {
    expect(matchSupplierBySellerName("Shenzhen UP3D Technology Co., Ltd.", suppliers)).toBe("up3d");
    expect(matchSupplierBySellerName("SAESHIN PRECISION CO., LTD.", suppliers)).toBe("saeshin");
    expect(matchSupplierBySellerName("Ningbo Runyes Medical Instrument Co.,Ltd", suppliers)).toBe("runyes");
    expect(matchSupplierBySellerName("Shenzhen Upcera Dental Technology Co., Ltd", suppliers)).toBe("upcera");
    expect(matchSupplierBySellerName("SONGYOUNG INTERNATIONAL", suppliers)).toBe("song");
    expect(matchSupplierBySellerName("ASWAD INSTRUMENTS", suppliers)).toBe("aswad");
  });
  it("brak lub niejednoznaczność → null", () => {
    expect(matchSupplierBySellerName("Shenzhen Technology Co., Ltd", suppliers)).toBeNull();
    expect(matchSupplierBySellerName("", suppliers)).toBeNull();
    expect(matchSupplierBySellerName("Acme Dental GmbH", suppliers)).toBeNull();
  });
});

describe("nextStage", () => {
  const k = (kind: Parameters<typeof nextStage>[1]["kind"], customsCode: string | null = null) => ({ kind, customsCode });
  it("idzie naprzód i nie cofa się", () => {
    expect(nextStage("request", k("replied"))).toBe("replied");
    expect(nextStage("replied", k("confirmation"))).toBe("confirmed");
    expect(nextStage("confirmed", k("customs", "ZCX91"))).toBe("declared");
    expect(nextStage("declared", k("customs", "ZC429"))).toBe("released");
    expect(nextStage("released", k("replied"))).toBe("released");
    expect(nextStage("confirmed", k("reminder"))).toBe("confirmed");
  });
  it("cło / płatność / doręczenie przesuwają etap", () => {
    expect(nextStage("request", k("paid"))).toBe("declared");
    expect(nextStage("confirmed", k("duties"))).toBe("declared");
    expect(nextStage("declared", k("delivered"))).toBe("released");
    expect(nextStage("released", k("duties"))).toBe("released");
  });
  it("pytanie agencji po naszej odpowiedzi znów czeka na nas", () => {
    expect(nextStage("replied", k("agency"))).toBe("request");
    expect(nextStage("confirmed", k("agency"))).toBe("confirmed");
  });
});
