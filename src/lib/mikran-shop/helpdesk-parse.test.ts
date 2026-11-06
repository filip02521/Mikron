import { describe, expect, it } from "vitest";
import {
  decodeHtmlEntities,
  extractInvoiceNumber,
  isClosedHelpdeskStatus,
  isStaffEmail,
  nipDigits,
  splitProductSerial,
  parseHelpdeskNumber,
  parseHelpdeskMessages,
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

  it("nieznany kształt → pusta lista", () => {
    expect(parseHelpdeskMessages(null)).toEqual([]);
    expect(parseHelpdeskMessages({ error: "x" })).toEqual([]);
  });
});
