import { beforeEach, describe, expect, it, vi } from "vitest";

const requireServicePanel = vi.hoisted(() => vi.fn());
const helpdeskWriteEnabled = vi.hoisted(() => vi.fn());
const fetchHelpdeskTicket = vi.hoisted(() => vi.fn());
const fetchHelpdeskMessages = vi.hoisted(() => vi.fn());
const replyInHelpdesk = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), requireServicePanel }));
vi.mock("@/lib/mikran-shop/helpdesk", async (orig) => ({
  ...(await orig<typeof import("@/lib/mikran-shop/helpdesk")>()),
  helpdeskWriteEnabled,
  fetchHelpdeskTicket,
  fetchHelpdeskMessages,
  replyInHelpdesk,
}));

import { actionServiceHelpdeskReply } from "./service-orders";

const thread = [{ id: 1, at: "2026-11-17 10:00", author: "Serwis TEST", staff: true, hidden: false, auto: false, text: "Odpowiedź", status: "" }];

describe("actionServiceHelpdeskReply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireServicePanel.mockResolvedValue({ id: "u1", role: "serwis", email: "serwis.test@ontime.local" });
    helpdeskWriteEnabled.mockResolvedValue(true);
    fetchHelpdeskTicket.mockResolvedValue({ mode: "live", ticket: { id: 4700, statusId: 4 } });
    fetchHelpdeskMessages.mockResolvedValue({ mode: "live", messages: thread });
    replyInHelpdesk.mockResolvedValue(undefined);
  });

  it("wysyła z wyborem maila, status zgłoszenia bez zmian, zwraca odświeżoną rozmowę", async () => {
    const r = await actionServiceHelpdeskReply(4700, "  Część już jest, naprawa jutro.  ", false);
    expect(requireServicePanel).toHaveBeenCalledWith("mutate");
    expect(replyInHelpdesk).toHaveBeenCalledWith(4700, 4, "Część już jest, naprawa jutro.", false);
    expect(r).toEqual({ ok: true, messages: thread });
  });

  it("odpowiedź poszła, a odświeżenie nie — sukces bez rozmowy (żeby nie wysłać drugi raz)", async () => {
    fetchHelpdeskMessages.mockRejectedValue(new Error("timeout"));
    expect(await actionServiceHelpdeskReply(4700, "Tekst", true)).toEqual({ ok: true, messages: null });
  });

  it("pusta treść, zły wybór maila, wyłączony zapis, brak statusu — nic nie wysyła", async () => {
    expect(await actionServiceHelpdeskReply(4700, "   ", true)).toMatchObject({ ok: false, message: "Wpisz treść odpowiedzi." });
    expect(await actionServiceHelpdeskReply(4700, "Tekst", "tak" as unknown as boolean)).toMatchObject({ ok: false });
    helpdeskWriteEnabled.mockResolvedValueOnce(false);
    expect(await actionServiceHelpdeskReply(4700, "Tekst", true)).toMatchObject({ ok: false, message: expect.stringMatching(/wyłączone/) });
    fetchHelpdeskTicket.mockResolvedValueOnce({ mode: "live", ticket: { id: 4700, statusId: null } });
    expect(await actionServiceHelpdeskReply(4700, "Tekst", true)).toMatchObject({ ok: false });
    expect(replyInHelpdesk).not.toHaveBeenCalled();
  });

  it("podgląd admina (tylko odczyt) blokuje wysyłkę", async () => {
    requireServicePanel.mockRejectedValueOnce(new Error("Podgląd panelu jest tylko do odczytu."));
    await expect(actionServiceHelpdeskReply(4700, "Tekst", true)).rejects.toThrow(/tylko do odczytu/);
    expect(replyInHelpdesk).not.toHaveBeenCalled();
  });
});
