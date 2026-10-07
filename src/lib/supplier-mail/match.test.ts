import { describe, expect, it } from "vitest";
import {
  buildSenderIndex,
  documentRefs,
  gmailSenderQueries,
  linkToCase,
  parseFromHeader,
  senderSearchTerms,
  suppliersForSender,
  supplierMailCategory,
  type MailCase,
} from "@/lib/supplier-mail/match";

const index = buildSenderIndex([
  { id: "renfert", mails: "order@renfert.de", notes: "Max - max.weber@renfert.de", extra_info: null },
  { id: "dreve", mails: "info@dreve.de", notes: null, extra_info: null },
  { id: "dreve-eco", mails: "eco@dreve.de", notes: null, extra_info: null },
  { id: "kowalski", mails: "jan.kowalski@wp.pl", notes: "login: sklep@wp.pl hasło: x", extra_info: "zamawia ola@mikran.com" },
]);

describe("poczta dostawców — nadawcy", () => {
  it("adres z karty, domena firmowa (też inny pracownik), domena ogólna tylko po pełnym adresie", () => {
    expect(suppliersForSender(index, "Order@Renfert.de")).toEqual(["renfert"]);
    expect(suppliersForSender(index, "ksiegowosc@renfert.de")).toEqual(["renfert"]);
    expect(suppliersForSender(index, "eco@dreve.de")).toEqual(["dreve-eco"]);
    expect(suppliersForSender(index, "ktos@dreve.de")).toEqual(["dreve", "dreve-eco"]);
    expect(suppliersForSender(index, "jan.kowalski@wp.pl")).toEqual(["kowalski"]);
    expect(suppliersForSender(index, "inny@wp.pl")).toEqual([]);
    // Login do portalu i adres Mikranu z karty nie są nadawcami dostawcy.
    expect(suppliersForSender(index, "sklep@wp.pl")).toEqual([]);
    expect(suppliersForSender(index, "ola@mikran.com")).toEqual([]);
  });

  it("zapytania Gmaila: domeny + adresy z domen ogólnych, w paczkach", () => {
    expect(senderSearchTerms(index)).toEqual(["dreve.de", "jan.kowalski@wp.pl", "renfert.de"]);
    const after = new Date("2026-10-01T00:00:00Z");
    expect(gmailSenderQueries(["a.de", "b.de"], after)).toEqual([
      "from:(a.de OR b.de) after:1790812800 -in:sent -in:drafts -in:chats",
    ]);
    const many = Array.from({ length: 200 }, (_, i) => `dostawca${i}.de`);
    const queries = gmailSenderQueries(many, after);
    expect(queries.length).toBeGreaterThan(1);
    expect(queries.every((q) => q.length <= 1200)).toBe(true);
    expect(queries.join(" ").match(/dostawca\d+\.de/g)).toHaveLength(200);
  });

  it("nagłówek From", () => {
    expect(parseFromHeader('"Anna Schmidt" <A.Schmidt@renfert.de>')).toEqual({ email: "a.schmidt@renfert.de", name: "Anna Schmidt" });
    expect(parseFromHeader("order@renfert.de")).toEqual({ email: "order@renfert.de", name: "" });
  });
});

describe("poczta dostawców — przypinanie do sprawy", () => {
  const cases: MailCase[] = [
    { kind: "zd", id: "zd-69", supplierId: "renfert", threadId: "t-69", dokNr: "ZD 69/M/10/2026", dokId: 1869300, boardThreadId: null, sentAt: "2026-10-05", resolved: false },
    { kind: "zd", id: "zd-70", supplierId: "renfert", threadId: "t-70", dokNr: "ZD 70/M/10/2026", dokId: 1869309, boardThreadId: null, sentAt: "2026-10-07", resolved: false },
    { kind: "zd", id: "zd-old", supplierId: "renfert", threadId: "t-old", dokNr: "ZD 50/M/09/2026", dokId: 1860000, boardThreadId: null, sentAt: "2026-10-08", resolved: true },
    { kind: "inquiry", id: "inq-1", supplierId: "dreve", threadId: "t-inq", dokNr: null, dokId: null, boardThreadId: "fec3e5f1-eda7-4ef8-bf50-dfca6c8288ea", sentAt: "2026-10-06", resolved: false },
  ];

  it("numery ZD i znaczniki zapytań w tekście", () => {
    expect(documentRefs("RE: New order ZD 70/m/10/2026, ZD nr 69/M/10/2026; OC_ZD #1869309.pdf [OnTime #FEC3E5F1]")).toEqual({
      dokNrs: ["70/M/10/2026", "69/M/10/2026"],
      dokIds: [1869309],
      inquiryRefs: ["fec3e5f1"],
    });
  });

  it("wątek → numer ZD → znacznik zapytania → ostatnie otwarte ZD jedynego dostawcy → brak", () => {
    expect(linkToCase({ threadId: "t-69", text: "ZD 70/M/10/2026", supplierIds: ["renfert"] }, cases)).toEqual({
      caseKind: "zd",
      caseId: "zd-69",
      linkedBy: "thread",
    });
    expect(linkToCase({ threadId: "inny", text: "Order confirmation ZD 69/M/10/2026", supplierIds: ["renfert"] }, cases)).toMatchObject({
      caseId: "zd-69",
      linkedBy: "document",
    });
    expect(linkToCase({ threadId: "inny", text: "AB zu ZD #1869309", supplierIds: ["renfert"] }, cases)).toMatchObject({
      caseId: "zd-70",
      linkedBy: "document",
    });
    expect(linkToCase({ threadId: "inny", text: "Re: Product inquiry [OnTime #fec3e5f1]", supplierIds: [] }, cases)).toMatchObject({
      caseKind: "inquiry",
      caseId: "inq-1",
      linkedBy: "document",
    });
    // Bez numeru: najnowsze otwarte ZD (zamknięte pomija).
    expect(linkToCase({ threadId: "inny", text: "Auftragsbestätigung", supplierIds: ["renfert"] }, cases)).toEqual({
      caseKind: "zd",
      caseId: "zd-70",
      linkedBy: "supplier",
    });
    // Kilku możliwych dostawców (wspólna domena) albo żaden — bez zgadywania.
    expect(linkToCase({ threadId: "inny", text: "Info", supplierIds: ["dreve", "dreve-eco"] }, cases)).toBeNull();
    expect(linkToCase({ threadId: "inny", text: "Info", supplierIds: ["kowalski"] }, cases)).toBeNull();
  });
});

describe("poczta dostawców — numer ZD bez przedrostka i kategorie", () => {
  it("numer ZD bez „ZD”; numer faktury i daty nie pasują", () => {
    expect(documentRefs("AW: New order 26/M/10/2026 // #336").dokNrs).toEqual(["26/M/10/2026"]);
    expect(documentRefs("Faktura nr F/001585/10/2026, 12/10/2026, 1/2/10/2026").dokNrs).toEqual([]);
  });

  const cat = (subject: string, attachmentNames: string[] = [], from = "a@renfert.de", bulk = false) =>
    supplierMailCategory({ from, subject, attachmentNames, bulk });

  it("kategorie z prawdziwych tematów", () => {
    expect(cat("Ivoclar Faktura 38905235")).toBe("invoice");
    expect(cat("Customer invoice n. 0001148 - MIKRAN SP. Z.O.O.", [], "no-reply@larident.it")).toBe("invoice");
    expect(cat("Graphenano Dental, SL - Albarán de venta AVD26-00434")).toBe("shipping");
    expect(cat("Graphenano Dental, SL - Sales Order PVD26-00395")).toBe("confirmation");
    expect(cat("AW: New order 26/M/10/2026 // #336", ["AB_12345.pdf"])).toBe("confirmation");
    expect(cat("RE: New Order - MIKRAN", ["Invoice_778.pdf"])).toBe("invoice");
    expect(cat("RE: Zamówienie Mikran")).toBe("reply");
    expect(cat("Re: Pytanie - wycena i dostępność")).toBe("reply");
    expect(cat("Live the REVOLUTION", [], "news@bartmedical.com")).toBe("newsletter");
    expect(cat("Promocja: ViscoStat 2+1 z rabatem 50%", [], "dornwell@dornwell.pl", true)).toBe("newsletter");
    expect(cat("Promocja: ViscoStat 2+1 z rabatem 50%", [], "dornwell@dornwell.pl")).toBe("newsletter");
    expect(cat("RĘKAWICZKI - OFERTA HURTOWA", [], "biuro@kol-dental.pl")).toBe("newsletter");
    expect(cat("Re: promocja na frezy - zamówienie Mikran", [], "biuro@kol-dental.pl")).toBe("reply");
  });
});
