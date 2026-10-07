import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  requireZdEstimateAdmin: vi.fn(),
  lastSupplierOrderEmail: vi.fn(),
  sendGmailAsUser: vi.fn(),
  recordSupplierOrderEmail: vi.fn(),
  loadSupplierZd: vi.fn(),
  renderSupplierForm: vi.fn(),
  getSubiektOrdersZdPdf: vi.fn(),
  setSubiektOrdersZdTermin: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(),
  requireZdEstimateAdmin: m.requireZdEstimateAdmin,
  SESSION_REQUIRED_ERROR: "Brak sesji",
}));
vi.mock("@/lib/google/gmail-connections", () => ({
  EMAIL_SIGNATURE_MAX: 1000,
  deleteGmailConnection: vi.fn(),
  getEmailSignature: vi.fn(),
  getGmailConnection: vi.fn(),
  saveEmailSignature: vi.fn(),
  lastSupplierOrderEmail: m.lastSupplierOrderEmail,
  sendGmailAsUser: m.sendGmailAsUser,
  recordSupplierOrderEmail: m.recordSupplierOrderEmail,
}));
vi.mock("@/lib/supplier-forms/prepare", () => ({ loadSupplierZd: m.loadSupplierZd }));
vi.mock("@/lib/supplier-forms/render", () => ({ renderSupplierForm: m.renderSupplierForm }));
vi.mock("@/lib/subiekt/api", () => ({
  getSubiektOrdersZdPdf: m.getSubiektOrdersZdPdf,
  setSubiektOrdersZdTermin: m.setSubiektOrdersZdTermin,
}));
vi.mock("@/lib/time/warsaw", () => ({ todayDateKeyInWarsaw: () => "2026-10-07" }));

import { actionSendZdToSupplier } from "@/app/actions/gmail";

const zd = (name: string, location: string) => ({
  ok: true,
  supplier: { id: "sup-1", name, location, cardEmails: ["order@renfert.de"] },
  lines: [{ symbol: "7700020", name: "Renfert-EASY blank wax", qty: 1 }],
  date: new Date(2026, 9, 5),
  dokNr: "ZD 45/M/10/2026",
});

const input = {
  dokId: 1867748,
  supplierId: "sup-1",
  to: "order@renfert.de",
  subject: "New order ZD 45/M/10/2026",
  body: "Dear Sir or Madam,",
};

beforeEach(() => {
  vi.clearAllMocks();
  m.requireZdEstimateAdmin.mockResolvedValue({ id: "user-1", email: "filip.naskret@mikran.com" });
  m.lastSupplierOrderEmail.mockResolvedValue(null);
  m.recordSupplierOrderEmail.mockResolvedValue(undefined);
  m.sendGmailAsUser.mockResolvedValue({ ok: true, from: "filip.naskret@mikran.com", messageId: "g-1" });
  m.getSubiektOrdersZdPdf.mockResolvedValue(Buffer.from("%PDF-1.2 wydruk ZD z Subiekta"));
});

describe("actionSendZdToSupplier", () => {
  it("dostawca bez formularza (też z importu) → wydruk ZD z Subiekta, wysyłka jako zalogowany, ślad zapisany", async () => {
    m.loadSupplierZd.mockResolvedValue(zd("Shenzhen Upcera Dental", "IMPORT"));
    const res = await actionSendZdToSupplier({ ...input, cc: "Kierownik@mikran.com, order@renfert.de" });
    expect(res).toMatchObject({ ok: true, to: ["order@renfert.de"], cc: ["kierownik@mikran.com"], attachmentName: "ZD 45-M-10-2026.pdf" });
    // ZD bez terminu „dziś” → termin wraca na dziś i wydruk jest świeży (dostawca widzi dzisiejszą datę).
    expect(m.setSubiektOrdersZdTermin).toHaveBeenCalledWith(1867748, "2026-10-07");
    expect(m.getSubiektOrdersZdPdf).toHaveBeenCalledWith(1867748, { fresh: true });
    const sent = m.sendGmailAsUser.mock.calls[0]![0];
    expect(sent.userId).toBe("user-1");
    expect(sent.kind).toBe("supplier_order");
    expect(sent.cc).toEqual(["kierownik@mikran.com"]);
    expect(sent.attachments[0].content.subarray(0, 4).toString()).toBe("%PDF");
    expect(m.recordSupplierOrderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ dokId: 1867748, supplierId: "sup-1", sentBy: "user-1", gmailMessageId: "g-1" })
    );
  });

  it("dostawca z własnym formularzem → załącznik to formularz, nie PDF zamówienia", async () => {
    m.loadSupplierZd.mockResolvedValue(zd("Wiedent", "POLSKA"));
    m.renderSupplierForm.mockResolvedValue({ bytes: new Uint8Array([1]), contentType: "application/pdf", fileName: "Wiedent 5.10.pdf" });
    const res = await actionSendZdToSupplier(input);
    expect(res).toMatchObject({ ok: true, attachmentName: "Wiedent 5.10.pdf" });
  });

  it("ZD już wysłane → bez wysyłki, z informacją kiedy i do kogo; resend wysyła", async () => {
    const previous = { sentAt: "2026-10-05T08:12:00.000Z", from: "filip.naskret@mikran.com", to: ["order@renfert.de"], attachmentName: "x.pdf" };
    m.lastSupplierOrderEmail.mockResolvedValue(previous);
    m.loadSupplierZd.mockResolvedValue(zd("Shenzhen Upcera Dental", "IMPORT"));

    expect(await actionSendZdToSupplier(input)).toMatchObject({ ok: false, alreadySent: previous });
    expect(m.sendGmailAsUser).not.toHaveBeenCalled();

    expect(await actionSendZdToSupplier({ ...input, resend: true })).toMatchObject({ ok: true });
    expect(m.sendGmailAsUser).toHaveBeenCalledTimes(1);
  });

  it("walidacja: błędny adres, pusty temat, obce ZD — nic nie wychodzi", async () => {
    expect(await actionSendZdToSupplier({ ...input, to: "nie-mail" })).toMatchObject({ ok: false });
    expect(await actionSendZdToSupplier({ ...input, subject: "  " })).toMatchObject({ ok: false });
    m.loadSupplierZd.mockResolvedValue({ ok: false, message: "ZD 1/26 nie jest wystawione na Renfert" });
    expect(await actionSendZdToSupplier(input)).toEqual({ ok: false, message: "ZD 1/26 nie jest wystawione na Renfert" });
    expect(m.sendGmailAsUser).not.toHaveBeenCalled();
  });

  it("adres spoza karty dostawcy → wymaga potwierdzenia, potem wysyła", async () => {
    m.loadSupplierZd.mockResolvedValue(zd("Shenzhen Upcera Dental", "IMPORT"));
    const res = await actionSendZdToSupplier({ ...input, to: "obcy@example.com" });
    expect(res).toMatchObject({ ok: false, unknownRecipients: ["obcy@example.com"] });
    expect(m.sendGmailAsUser).not.toHaveBeenCalled();
    expect(await actionSendZdToSupplier({ ...input, to: "obcy@example.com", allowUnknownRecipients: true })).toMatchObject({ ok: true });
  });

  it("Gmail odrzucił (cofnięta zgoda) → błąd z prośbą o ponowne połączenie, bez śladu wysyłki", async () => {
    m.loadSupplierZd.mockResolvedValue(zd("Shenzhen Upcera Dental", "IMPORT"));
    m.sendGmailAsUser.mockResolvedValue({ ok: false, message: "Połącz ponownie", reconnect: true });
    expect(await actionSendZdToSupplier(input)).toMatchObject({ ok: false, reconnect: true });
    expect(m.recordSupplierOrderEmail).not.toHaveBeenCalled();
  });
});

describe("actionSendZdToSupplier — DW", () => {
  it("błędny adres w DW zatrzymuje wysyłkę z komunikatem", async () => {
    m.loadSupplierZd.mockResolvedValue(zd("Renfert", "IMPORT"));
    const res = await actionSendZdToSupplier({ ...input, cc: "kierownik@" });
    expect(res).toEqual({ ok: false, message: "Błędny adres w polu DW: kierownik@" });
    expect(m.sendGmailAsUser).not.toHaveBeenCalled();
  });
});

describe("actionSendZdToSupplier — termin na wydruku", () => {
  it("ZD z terminem dziś → bez zmiany terminu, wydruk z pamięci", async () => {
    m.loadSupplierZd.mockResolvedValue({ ...zd("Formlabs", "IMPORT"), termin: "2026-10-07" });
    await actionSendZdToSupplier(input);
    expect(m.setSubiektOrdersZdTermin).not.toHaveBeenCalled();
    expect(m.getSubiektOrdersZdPdf).toHaveBeenCalledWith(1867748, { fresh: false });
  });
  it("dostawca z formularzem → termin ZD nie jest ruszany przed wysyłką", async () => {
    m.loadSupplierZd.mockResolvedValue({ ...zd("Wiedent", "POLSKA"), termin: "2026-10-30" });
    m.renderSupplierForm.mockResolvedValue({ bytes: new Uint8Array([1]), contentType: "application/pdf", fileName: "Wiedent.pdf" });
    await actionSendZdToSupplier(input);
    expect(m.setSubiektOrdersZdTermin).not.toHaveBeenCalled();
  });
});

describe("actionSendZdToSupplier — nieudana wysyłka", () => {
  it("Gmail odrzucił → termin wraca do daty sprzed wysyłki", async () => {
    m.loadSupplierZd.mockResolvedValue({ ...zd("Shenzhen Upcera Dental", "IMPORT"), termin: "2026-10-20" });
    m.setSubiektOrdersZdTermin.mockResolvedValue("2026-10-07");
    m.sendGmailAsUser.mockResolvedValue({ ok: false, message: "Gmail nie wysłał wiadomości: 500" });
    expect(await actionSendZdToSupplier(input)).toMatchObject({ ok: false });
    expect(m.setSubiektOrdersZdTermin.mock.calls).toEqual([
      [1867748, "2026-10-07"],
      [1867748, "2026-10-20"],
    ]);
  });

  it("błąd wydruku po zmianie terminu → termin wraca; udana wysyłka → nie wraca", async () => {
    m.loadSupplierZd.mockResolvedValue({ ...zd("Shenzhen Upcera Dental", "IMPORT"), termin: "2026-10-20" });
    m.setSubiektOrdersZdTermin.mockResolvedValue("2026-10-07");
    m.getSubiektOrdersZdPdf.mockRejectedValueOnce(new Error("Subiekt nie wydrukował ZD do PDF (HTTP 500)."));
    expect(await actionSendZdToSupplier(input)).toMatchObject({ ok: false });
    expect(m.setSubiektOrdersZdTermin).toHaveBeenLastCalledWith(1867748, "2026-10-20");

    m.setSubiektOrdersZdTermin.mockClear();
    expect(await actionSendZdToSupplier(input)).toMatchObject({ ok: true });
    expect(m.setSubiektOrdersZdTermin.mock.calls).toEqual([[1867748, "2026-10-07"]]);
  });
});
