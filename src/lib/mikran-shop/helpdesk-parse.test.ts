import { describe, expect, it } from "vitest";
import {
  decodeHtmlEntities,
  extractInvoiceNumber,
  splitInvoiceField,
  cleanMessageText,
  isClosedHelpdeskStatus,
  isStaffEmail,
  nipDigits,
  splitProductSerial,
  parseHelpdeskNumber,
  parseHelpdeskMessages,
  extractTicketSerials,
  productQuantity,
  parseHelpdeskTicket,
} from "@/lib/mikran-shop/helpdesk-parse";

describe("parseHelpdeskTicket", () => {
  it("czyta wiersz oc_service z encjami HTML", () => {
    const t = parseHelpdeskTicket({
      service_id: "1234",
      name: "Gabinet &quot;Uśmiech&quot;",
      email: "a@b.pl",
      telephone: "600 100 200",
      vat: "PL 123-456-78-90",
      product: "Mikrosilnik &oacute;smy",
      comment: "Nie rusza<br />po w&#322;&#261;czeniu",
      date_added: "2026-11-05 10:00:00",
      service_status_id: "1",
      status: "Nowe zgłoszenie",
      employee_id: 7,
      delivery_id: "1",
    });
    expect(t).toMatchObject({
      id: 1234,
      name: 'Gabinet "Uśmiech"',
      product: "Mikrosilnik ósmy",
      comment: "Nie rusza\npo włączeniu",
      statusId: 1,
      employeeId: 7,
      deliveryId: 1,
      test: false,
    });
  });

  it("bez pola comment bierze najstarszą wiadomość wątku i rozpakowuje { data }", () => {
    const t = parseHelpdeskTicket({
      data: {
        id: 5,
        messages: [
          { date_added: "2026-11-06 09:00", comment: "Odpowiedź serwisu" },
          { date_added: "2026-11-05 08:00", comment: "Opis klienta" },
        ],
      },
    });
    expect(t?.comment).toBe("Opis klienta");
  });

  it("odrzuca wiersz bez numeru i nie-obiekt", () => {
    expect(parseHelpdeskTicket({ name: "x" })).toBeNull();
    expect(parseHelpdeskTicket(null)).toBeNull();
    expect(parseHelpdeskTicket({ error: "not found" })).toBeNull();
  });
});

describe("pomocnicze", () => {
  it("zakończone po nazwie statusu", () => {
    expect(isClosedHelpdeskStatus("Zakończone")).toBe(true);
    expect(isClosedHelpdeskStatus("Przyjęte do realizacji")).toBe(false);
    expect(isClosedHelpdeskStatus("")).toBe(false);
  });

  it("NIP: same cyfry albo pusty", () => {
    expect(nipDigits("PL 123-456-78-90")).toBe("1234567890");
    expect(nipDigits("12345")).toBe("");
  });

  it("numer zgłoszenia w kilku zapisach", () => {
    expect(parseHelpdeskNumber("#1234")).toBe(1234);
    expect(parseHelpdeskNumber(" hd 77 ")).toBe(77);
    expect(parseHelpdeskNumber("ZS/26/11/001")).toBeNull();
    expect(parseHelpdeskNumber("0")).toBeNull();
  });

  it("zostawia nieznaną encję", () => {
    expect(decodeHtmlEntities("a &zzz; b &amp; c")).toBe("a &zzz; b & c");
  });
});

describe("splitProductSerial", () => {
  it("wydziela numer po SN, S/N, SN:", () => {
    expect(splitProductSerial("Forte 400& SN X99TEST01")).toEqual({ name: "Forte 400", serial: "X99TEST01" });
    expect(splitProductSerial("Turbina S/N: 4321")).toEqual({ name: "Turbina", serial: "4321" });
    expect(splitProductSerial("Wiertarka X100 SN 9Z0001")).toEqual({ name: "Wiertarka X100", serial: "9Z0001" });
  });

  it("bez znacznika SN zostawia całość; nie łapie SN w środku słowa", () => {
    expect(splitProductSerial("Prostnica")).toEqual({ name: "Prostnica", serial: "" });
    expect(splitProductSerial("Lampa SNOW 200")).toEqual({ name: "Lampa SNOW 200", serial: "" });
    expect(splitProductSerial("")).toEqual({ name: "", serial: "" });
  });
});

describe("isStaffEmail", () => {
  it("adresy mikran to pracownik", () => {
    expect(isStaffEmail("serwis@mikran.com")).toBe(true);
    expect(isStaffEmail("Biuro@Mikran.pl ")).toBe(true);
    expect(isStaffEmail("gabinet@example.com")).toBe(false);
  });
});

describe("extractInvoiceNumber", () => {
  it("z pola faktury, produktu albo opisu", () => {
    expect(extractInvoiceNumber("", "faktura nr 1617/M/09/2025. Marathon multi 600")).toBe("1617/M/09/2025");
    expect(extractInvoiceNumber("3025/m/11/2024 ")).toBe("3025/M/11/2024");
    expect(extractInvoiceNumber("", "Prostnica", "FV 434/M/11/2026 koszt 510 zł")).toBe("434/M/11/2026");
    expect(extractInvoiceNumber("", "Forte 100 SN X99TEST01", "zakup wrzesień 2026")).toBe("");
  });
});

describe("parseHelpdeskMessages", () => {
  it("od najstarszej, rozpoznaje wpis serwisu i ukryty komentarz, pomija puste", () => {
    const m = parseHelpdeskMessages({
      helpdesk_id: 1,
      messages: [
        { service_history_id: 2, date_added: "2026-10-26 14:46:28", comment: "Problem przeanalizowany", user_id: 7, hidden: 1 },
        { service_history_id: 1, date_added: "2026-10-26 13:44:57", comment: "Gdzie przesłać film?", user_id: 0, notify: 1 },
        { service_history_id: 3, date_added: "2026-10-27 08:00:00", comment: "" },
      ],
    });
    expect(m.map((x) => [x.id, x.staff, x.hidden])).toEqual([
      [1, false, false],
      [2, true, true],
    ]);
  });

  it("autor jak w API sklepu (commented_name, potem pracownik / klient) i autoodpowiedź", () => {
    const m = parseHelpdeskMessages({
      messages: [
        { service_history_id: 1, date_added: "2026-11-01 09:00:00", comment: "Silnik nie rusza", user_id: 0, commented_name: "", customer_name: "Gabinet TEST", auto: 0 },
        { service_history_id: 2, date_added: "2026-11-01 09:01:00", comment: "Dziękujemy za zgłoszenie", user_id: 28, commented_name: "", employee_name: "Serwis TEST", auto: 1 },
        { service_history_id: 3, date_added: "2026-11-02 10:00:00", comment: "Prosimy o wysyłkę", user_id: 28, commented_name: "Jan TEST", employee_name: "Serwis TEST", auto: 0 },
      ],
    });
    expect(m.map((x) => [x.author, x.staff, x.auto])).toEqual([
      ["Gabinet TEST", false, false],
      ["Serwis TEST", true, true],
      ["Jan TEST", true, false],
    ]);
  });

  it("nieznany kształt → pusta lista", () => {
    expect(parseHelpdeskMessages(null)).toEqual([]);
    expect(parseHelpdeskMessages({ error: "x" })).toEqual([]);
  });
});

// Kształty z prawdziwych zgłoszeń serwisu; numery wymyślone.
describe("numery seryjne i liczba sztuk ze zgłoszenia", () => {
  it("SN z opisu: po „SN”, „SN:”, „SN.”, lista po przecinkach, koniec na słowie", () => {
    expect(extractTicketSerials("prostnica", "Przesyłam prostnicę SN X21TEST001. Należy wymienić: 4 x łożyska")).toEqual(["X21TEST001"]);
    expect(extractTicketSerials("4 x strong 105L", "Kontrola po naprawie. SN X1TEST0001, X1TEST0002, X1TEST0003 pozdrawiam")).toEqual([
      "X1TEST0001",
      "X1TEST0002",
      "X1TEST0003",
    ]);
    expect(extractTicketSerials("", "Lista napraw: SN: X2TEST0015 Mimo wymiany łożysk")).toEqual(["X2TEST0015"]);
    expect(extractTicketSerials("", "prostnica alfa SN.X2BTEST 001 Odbieram")).toEqual(["X2BTEST001"]);
    expect(extractTicketSerials("", "SN X1TEST0003, H400 do sprawdzenia")).toEqual(["X1TEST0003"]);
  });

  it("SN z produktu w nawiasie i ze spacją, bez powtórzeń z opisem; nazwa bez numeru", () => {
    const product = "Forte 200 - prostnica (SN X2BTEST 054)";
    expect(extractTicketSerials(product, "Przesyłam prostnice SN X2BTEST054 należy wymienić")).toEqual(["X2BTEST054"]);
    expect(splitProductSerial(product)).toEqual({ name: "Forte 200 - prostnica", serial: "X2BTEST054" });
    expect(splitProductSerial("Forte 100 - SN X21TEST007")).toEqual({ name: "Forte 100", serial: "X21TEST007" });
  });

  it("bez znacznika SN nic nie zgaduje (numer faktury, telefon, ilość)", () => {
    expect(extractTicketSerials("Garnek Aqua", "FV 434/M/11/2026, tel. 600 100 200, 4 x łożysko")).toEqual([]);
  });

  it("liczba sztuk z produktu: „4 x …”, „2x …”, „3 szt. …”; jedna sztuka to null", () => {
    expect(productQuantity("4 x strong 105L")).toBe(4);
    expect(productQuantity("2x prostnica")).toBe(2);
    expect(productQuantity("3 szt. kątnica")).toBe(3);
    expect(productQuantity("1 x prostnica")).toBeNull();
    expect(productQuantity("Forte 100 alfa III")).toBeNull();
  });
});

describe("splitInvoiceField", () => {
  it("numer faktury z pola, produktu albo opisu; krótki numer bez spacji też", () => {
    expect(splitInvoiceField("3025/m/11/2024 ")).toEqual({ invoice: "3025/M/11/2024", note: "" });
    expect(splitInvoiceField("", "Forte 100", "faktura nr 1617/M/09/2025")).toEqual({ invoice: "1617/M/09/2025", note: "" });
    expect(splitInvoiceField("FV1617")).toEqual({ invoice: "FV1617", note: "" });
  });

  it("tekst zamiast numeru to wiadomość klienta, nie faktura do szukania", () => {
    expect(splitInvoiceField("naprawa po gwarancji")).toEqual({ invoice: "", note: "naprawa po gwarancji" });
    expect(splitInvoiceField("nie pamiętam")).toEqual({ invoice: "", note: "nie pamiętam" });
    expect(splitInvoiceField("brak")).toEqual({ invoice: "", note: "brak" });
    expect(splitInvoiceField("  ")).toEqual({ invoice: "", note: "" });
  });
});

// Kształty z prawdziwych zgłoszeń; treść i podpisy wymyślone.
describe("usterka ze zgłoszenia", () => {
  it("bez powitania i podpisu, bez pustych wierszy", () => {
    expect(cleanMessageText("Witam,\n\nSilnik nie rusza.\nIskrzy przy obrotach.\n\nPozdrawiam\nJan TEST")).toBe("Silnik nie rusza.\nIskrzy przy obrotach.");
    expect(cleanMessageText("Hej Adam\nPrzesyłam prostnicę do naprawy.")).toBe("Przesyłam prostnicę do naprawy.");
    expect(cleanMessageText("Dzień dobry, lampa gaśnie\nZ poważaniem\nGabinet TEST")).toBe("Dzień dobry, lampa gaśnie");
  });

  it("samo „Pozdrawiam” w środku długiego listu zostaje; jednowierszowy opis bez zmian", () => {
    const long = "A\nPozdrawiam też kolegę\nB\nC\nD\nE\nF";
    expect(cleanMessageText(long)).toBe(long);
    expect(cleanMessageText("Luźne wrzeciono")).toBe("Luźne wrzeciono");
  });

  it("zgłoszenie założone przez serwis: usterka z pierwszej wiadomości klienta", () => {
    const t = parseHelpdeskTicket({
      service_id: 7,
      comment: "Witam,\nDiagnoza: wymiana łożysk, koszt 300 zł.\nPozdrawiam\nSerwis TEST",
      messages: [
        { date_added: "2026-11-01 09:00", comment: "Witam,\nDiagnoza: wymiana łożysk, koszt 300 zł.\nPozdrawiam\nSerwis TEST", user_id: 28 },
        { date_added: "2026-11-01 10:00", comment: "Dziękujemy", user_id: 28, auto: 1 },
        { date_added: "2026-11-01 11:00", comment: "Dane zgłoszeniaZgłoszenie do serwisuGabinet TEST500 000 000", user_id: 0 },
        { date_added: "2026-11-02 08:00", comment: "Dzień dobry\nProstnica grzeje się i hałasuje.", user_id: 0 },
      ],
    });
    expect(t).toMatchObject({ fault: "Prostnica grzeje się i hałasuje.", faultFrom: "klient" });
  });

  it("bez wiadomości klienta zostaje tekst serwisu, oznaczony", () => {
    const t = parseHelpdeskTicket({
      service_id: 8,
      messages: [{ date_added: "2026-11-01 09:00", comment: "Witam,\nWymiana przewodu.\nPozdrawiam\nSerwis TEST", user_id: 28 }],
    });
    expect(t).toMatchObject({ fault: "Wymiana przewodu.", faultFrom: "serwis" });
  });
});
