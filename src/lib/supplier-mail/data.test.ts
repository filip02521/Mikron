import { describe, expect, it } from "vitest";
import { boardItems, countNeedsAction, groupConversations, waitingCases, type MailMessageRow } from "@/lib/supplier-mail/data";

const msg = (over: Partial<MailMessageRow>): MailMessageRow => ({
  id: "m",
  mailbox: "filip@mikran.com",
  owner_user_id: null,
  gmail_message_id: "g",
  gmail_thread_id: "t1",
  rfc_message_id: null,
  supplier_id: "renfert",
  supplier_name: "Renfert",
  supplier_location: "ZAGRANICA",
  kind: "supplier",
  category: "reply",
  from_address: "m@renfert.de",
  from_name: "Miriam",
  subject: "Re: New order",
  snippet: "",
  attachments: [],
  received_at: new Date("2026-10-07T10:00:00Z"),
  case_kind: null,
  case_id: null,
  linked_by: null,
  zd_dok_nr: null,
  zd_dok_id: null,
  case_label: null,
  board_thread_id: null,
  handled_at: null,
  handled_via: null,
  triage: null,
  ...over,
});

describe("poczta dostawców — rozmowy", () => {
  it("wątek = jedna rozmowa; najnowsza wiadomość w nagłówku; potwierdzenie wygrywa kategorię", () => {
    const [c, other] = groupConversations([
      msg({ id: "1", gmail_message_id: "a", received_at: new Date("2026-10-06T10:00:00Z"), category: "confirmation", zd_dok_nr: "ZD 26/M/10/2026" }),
      msg({ id: "2", gmail_message_id: "b", subject: "Re: Re: New order", snippet: "najnowsza", attachments: [{ filename: "AB.pdf", attachmentId: "x", size: 1, mimeType: "application/pdf" }] }),
      msg({ id: "3", gmail_thread_id: "t2", received_at: new Date("2026-10-01T10:00:00Z"), category: "invoice" }),
    ]);
    expect(c).toMatchObject({
      key: "filip@mikran.com|t1",
      count: 2,
      subject: "Re: Re: New order",
      snippet: "najnowsza",
      category: "confirmation",
      attachments: 1,
      zdLabel: "ZD 26/M/10/2026",
      open: true,
    });
    // Faktura nie wymaga reakcji.
    expect(other).toMatchObject({ category: "invoice", open: false });
  });

  it("załatwione nie są otwarte; zwrot jest otwarty; sama autoodpowiedź nie", () => {
    const [done] = groupConversations([msg({ handled_at: new Date(), handled_via: "gmail" })]);
    expect(done).toMatchObject({ open: false, handledVia: "gmail" });
    const [bounce] = groupConversations([msg({ kind: "bounce", from_address: "mailer-daemon@googlemail.com", supplier_name: null })]);
    expect(bounce).toMatchObject({ open: true, bounce: true });
    const [auto] = groupConversations([msg({ kind: "auto" })]);
    expect(auto).toMatchObject({ open: false, autoReply: true });
  });
});

describe("poczta dostawców — sprawy czekające", () => {
  const base = {
    supplier_id: "renfert",
    sent_by: null,
    resolved_at: null,
    supplier_name: "Renfert",
    location: "ZAGRANICA" as const,
    label: "ZD 70/M/10/2026",
    board_thread_id: null,
    from_address: "filip@mikran.com",
    to_addresses: ["order@renfert.de"],
    reminded_at: null,
  };
  const now = new Date("2026-10-09T10:00:00Z");

  it("odpowiedź (też OC osobnym mailem) albo zwrot zdejmuje sprawę; autoodpowiedź zostawia z adnotacją", () => {
    const cases = [
      { ...base, kind: "zd" as const, id: "zd-1", sent_at: new Date("2026-10-05T10:00:00Z") },
      { ...base, kind: "zd" as const, id: "zd-2", sent_at: new Date("2026-10-05T10:00:00Z") },
      { ...base, kind: "zd" as const, id: "zd-3", sent_at: new Date("2026-10-05T10:00:00Z") },
      { ...base, kind: "zd" as const, id: "zd-4", sent_at: new Date("2026-10-08T10:00:00Z") },
    ];
    const res = waitingCases(
      cases,
      [
        msg({ case_kind: "zd", case_id: "zd-1", linked_by: "document" }),
        msg({ case_kind: "zd", case_id: "zd-2", kind: "bounce" }),
        msg({ case_kind: "zd", case_id: "zd-3", kind: "auto" }),
      ],
      now
    );
    expect(res.map((r) => [r.id, r.overdue, r.autoReply, r.english])).toEqual([
      ["zd-3", true, true, true],
      ["zd-4", false, false, true],
    ]);
  });

  it("przypomnienie liczy termin od nowa", () => {
    const [r] = waitingCases(
      [{ ...base, kind: "zd", id: "zd-1", sent_at: new Date("2026-10-01T10:00:00Z"), reminded_at: new Date("2026-10-08T10:00:00Z") }],
      [],
      now
    );
    expect(r).toMatchObject({ overdue: false, businessDays: 1, remindedAt: "2026-10-08T10:00:00.000Z" });
  });
});

describe("tablica spraw — pozycje", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const today = "2026-10-08";
  const zd = { kind: "zd" as const, id: "zd-1", label: "ZD 1", supplier_id: "s", supplier_name: "Renfert", location: "ZAGRANICA" as const,
    board_thread_id: null, from_address: "f@mikran.com", to_addresses: [], reminded_at: null, sent_by: "u1", resolved_at: null };

  it("faktura → Do zapłaty, odpowiedź dostawcy → Do zrobienia, ZD po terminie → Do zrobienia", () => {
    const convs = groupConversations([
      msg({ gmail_thread_id: "a", category: "invoice", handled_at: new Date(), handled_via: "manual" }),
      msg({ gmail_thread_id: "b", owner_user_id: "u2" }),
    ]);
    const cases = waitingCases([{ ...zd, sent_at: new Date("2026-10-01T10:00:00Z") }], [], now);
    const items = boardItems(convs, cases, new Map(), today);
    expect(items.map((i) => [i.key, i.column, i.assigneeId])).toEqual([
      ["conv:filip@mikran.com|a", "to_pay", null],
      ["conv:filip@mikran.com|b", "todo", "u2"],
      ["zd:zd-1", "todo", "u1"],
    ]);
  });

  it("odpowiedź na ZD dziedziczy opis sprawy i wraca z Czekam do Do zrobienia", () => {
    const [conv] = groupConversations([msg({ case_kind: "zd", case_id: "zd-1", linked_by: "thread" })]);
    const row = { column: "waiting" as const, columnSetAt: "2026-10-06T10:00:00Z", note: "czekam na termin", waitingOn: "", remindOn: "2026-10-20", assigneeId: null };
    const [item] = boardItems([conv!], [], new Map([["zd:zd-1", row]]), today);
    expect(item).toMatchObject({ column: "todo", reason: "Nowa wiadomość", note: "czekam na termin", manualColumn: null });
  });
});

describe("tablica spraw — poprawki z audytu", () => {
  const today = "2026-10-08";

  it("nadawca bez podpisu ma adres zamiast pustej nazwy", () => {
    const [c] = groupConversations([msg({ kind: "other", triage: "review", supplier_name: null, from_name: "", from_address: "jan@nowa.example" })]);
    expect(c!.supplierName).toBe("jan@nowa.example");
    expect(c!.triage).toBe("review");
  });

  it("należności agencji idą do Do zapłaty, po Zakończone — do zakończonych", () => {
    const dues = msg({ kind: "other", triage: "customs", supplier_name: null, subject: "Powiadomienie o należnościach - AWB 1" });
    const [open] = boardItems(groupConversations([dues]), [], new Map(), today);
    expect(open).toMatchObject({ column: "to_pay" });
    expect(open!.ref.type === "conv" && open!.ref.conv.customsKind).toBe("dues");
    const [closed] = boardItems(groupConversations([{ ...dues, handled_at: new Date(), handled_via: "manual" }]), [], new Map(), today);
    expect(closed!.column).toBe("done");
  });

  it("licznik: moje Do zrobienia i moja półka, nieprzypisane liczą się każdemu", () => {
    const items = boardItems(
      groupConversations([
        msg({ gmail_thread_id: "a", owner_user_id: "me" }),
        msg({ gmail_thread_id: "b", owner_user_id: "other" }),
        msg({ gmail_thread_id: "c", owner_user_id: null }),
      ]),
      [],
      new Map(),
      today
    );
    const review = groupConversations([msg({ gmail_thread_id: "r", kind: "other", triage: "review", owner_user_id: "other" })]);
    expect(countNeedsAction({ items, review }, "me")).toBe(2);
    expect(countNeedsAction({ items, review }, "other")).toBe(3);
  });

  it("odpowiedź spedytora w wątku ZD zamyka czekanie na to ZD", () => {
    const base = { kind: "zd" as const, id: "zd-9", label: "ZD 9", supplier_id: "s", supplier_name: "X", location: "POLSKA" as const,
      board_thread_id: null, from_address: "f@mikran.com", to_addresses: [], reminded_at: null, sent_by: null, resolved_at: null,
      sent_at: new Date("2026-10-01T10:00:00Z") };
    expect(waitingCases([base], [msg({ kind: "other", case_kind: "zd", case_id: "zd-9" })], new Date("2026-10-08T10:00:00Z"))).toEqual([]);
  });
});
