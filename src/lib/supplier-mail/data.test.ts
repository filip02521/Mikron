import { describe, expect, it } from "vitest";
import { groupConversations, waitingCases, type MailMessageRow } from "@/lib/supplier-mail/data";

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
