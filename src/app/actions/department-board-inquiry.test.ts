import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  requireOperations: vi.fn(),
  assertBoard: vi.fn(),
  query: vi.fn(),
  sendGmailAsUser: vi.fn(),
  loadInquirySupplierOptions: vi.fn(),
  listSupplierInquiries: vi.fn(),
  recordSupplierInquiry: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireOperations: m.requireOperations }));
vi.mock("@/lib/auth/guard-admin-panel-preview", () => ({
  assertAdminPanelAllowsProcurementBoardMutations: m.assertBoard,
}));
vi.mock("@/lib/db/pool", () => ({ query: m.query }));
vi.mock("@/lib/google/gmail", () => ({ getGmailOAuthConfig: () => ({}) }));
vi.mock("@/lib/google/gmail-connections", () => ({
  getEmailSignature: vi.fn(),
  getGmailConnection: vi.fn(),
  sendGmailAsUser: m.sendGmailAsUser,
}));
vi.mock("@/lib/department-board/supplier-inquiry-db", () => ({
  loadInquirySupplierOptions: m.loadInquirySupplierOptions,
  listSupplierInquiries: m.listSupplierInquiries,
  recordSupplierInquiry: m.recordSupplierInquiry,
}));

import { actionSendSupplierInquiry } from "@/app/actions/department-board-inquiry";

const THREAD_ID = "3f2a9c1e-0000-4000-8000-000000000001";
const thread = {
  id: THREAD_ID,
  kind: "question",
  title: "Frez 302801",
  product_name: "Frez Diadur Micro",
  product_symbol: "302801",
  mikran_code: null,
  subiekt_tw_id: 123,
  archived_at: null,
};
const dfs = { id: "sup-1", name: "DFS", location: "ZAGRANICA", english: true, emails: ["sales@dfs.de"] };
const input = { threadId: THREAD_ID, supplierId: "sup-1", to: "sales@dfs.de", subject: "Product inquiry", body: "Hello" };

beforeEach(() => {
  vi.clearAllMocks();
  m.requireOperations.mockResolvedValue({ id: "user-1", role: "zakupy" });
  m.assertBoard.mockResolvedValue(undefined);
  m.query.mockResolvedValue({ rows: [thread] });
  m.loadInquirySupplierOptions.mockResolvedValue({ suppliers: [dfs], suggestedIds: [] });
  m.listSupplierInquiries.mockResolvedValue(new Map());
  m.recordSupplierInquiry.mockResolvedValue(undefined);
  m.sendGmailAsUser.mockResolvedValue({ ok: true, from: "zakupy@mikran.pl", messageId: "g-1" });
});

describe("actionSendSupplierInquiry", () => {
  it("wysyła z Gmaila zalogowanej osoby, bez załączników, i zapisuje ślad przy wątku", async () => {
    const res = await actionSendSupplierInquiry(input);
    expect(res).toMatchObject({ ok: true, supplierName: "DFS", to: ["sales@dfs.de"] });
    expect(m.requireOperations).toHaveBeenCalledWith("mutate");
    const sent = m.sendGmailAsUser.mock.calls[0]![0];
    expect(sent).toMatchObject({ userId: "user-1", kind: "supplier_inquiry", attachments: [] });
    expect(m.recordSupplierInquiry).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: THREAD_ID, supplierId: "sup-1", sentBy: "user-1", gmailMessageId: "g-1" })
    );
  });

  it("bez uprawnień zakupów → błąd, nic nie wychodzi", async () => {
    m.requireOperations.mockRejectedValue(new Error("Brak uprawnień do operacji zakupowych"));
    await expect(actionSendSupplierInquiry(input)).rejects.toThrow("Brak uprawnień");
    expect(m.sendGmailAsUser).not.toHaveBeenCalled();
  });

  it("adres spoza karty dostawcy → pytanie o potwierdzenie; z potwierdzeniem wysyła", async () => {
    const res = await actionSendSupplierInquiry({ ...input, to: "ktos@gmail.com" });
    expect(res).toMatchObject({ ok: false, unknownRecipients: ["ktos@gmail.com"] });
    expect(m.sendGmailAsUser).not.toHaveBeenCalled();
    const ok = await actionSendSupplierInquiry({ ...input, to: "ktos@gmail.com", allowUnknownRecipients: true });
    expect(ok.ok).toBe(true);
  });

  it("zapytanie do tego dostawcy już czeka → bez wysyłki; resend wysyła", async () => {
    const pending = { id: "i1", supplierId: "sup-1", supplierName: "DFS", fromAddress: "a", toAddresses: [], sentAt: "2026-10-05T10:00:00.000Z", resolvedAt: null };
    m.listSupplierInquiries.mockResolvedValue(new Map([[THREAD_ID, [pending]]]));
    const res = await actionSendSupplierInquiry(input);
    expect(res).toMatchObject({ ok: false, alreadyPending: pending });
    expect(m.sendGmailAsUser).not.toHaveBeenCalled();
    expect((await actionSendSupplierInquiry({ ...input, resend: true })).ok).toBe(true);
  });

  it("czekające zapytanie do innego dostawcy nie blokuje; starsze do tego samego — blokuje", async () => {
    const other = { id: "i2", supplierId: "sup-2", supplierName: "Renfert", fromAddress: "a", toAddresses: [], sentAt: "2026-10-05T11:00:00.000Z", resolvedAt: null };
    m.listSupplierInquiries.mockResolvedValue(new Map([[THREAD_ID, [other]]]));
    expect((await actionSendSupplierInquiry(input)).ok).toBe(true);
    const sameOlder = { ...other, id: "i3", supplierId: "sup-1", supplierName: "DFS (stara nazwa)", sentAt: "2026-10-05T09:00:00.000Z" };
    m.listSupplierInquiries.mockResolvedValue(new Map([[THREAD_ID, [other, sameOlder]]]));
    expect(await actionSendSupplierInquiry(input)).toMatchObject({ ok: false, alreadyPending: sameOlder });
  });

  it("zamknięty wątek albo nie-pytanie → odmowa", async () => {
    m.query.mockResolvedValueOnce({ rows: [{ ...thread, archived_at: "2026-10-01T00:00:00Z" }] });
    expect(await actionSendSupplierInquiry(input)).toMatchObject({ ok: false });
    m.query.mockResolvedValueOnce({ rows: [{ ...thread, kind: "announcement" }] });
    expect(await actionSendSupplierInquiry(input)).toMatchObject({ ok: false, message: "Nie znaleziono pytania." });
    expect(m.sendGmailAsUser).not.toHaveBeenCalled();
  });

  it("dostawca spoza listy (nieaktywny / bez adresu) → odmowa", async () => {
    expect(await actionSendSupplierInquiry({ ...input, supplierId: "obcy" })).toMatchObject({
      ok: false,
      message: "Wybierz dostawcę z listy.",
    });
  });
});
