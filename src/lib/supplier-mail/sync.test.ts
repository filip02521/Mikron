import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ query: vi.fn(), getGmailMessageMeta: vi.fn(), listGmailMessageIds: vi.fn() }));

vi.mock("@/lib/db/pool", () => ({ query: m.query }));
vi.mock("@/lib/customs/dhl-sync", () => ({ syncDhlMailbox: async () => 0, prepareWaitingShipments: async () => undefined }));
vi.mock("@/lib/google/gmail", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/google/gmail")>()),
  getGmailOAuthConfig: () => ({ clientId: "c", clientSecret: "s", redirectUri: "r", tokenKey: Buffer.alloc(32) }),
  decryptToken: () => "1//refresh",
  gmailAccessToken: async () => "ya29.token",
  listGmailMessageIds: m.listGmailMessageIds,
  getGmailMessageMeta: m.getGmailMessageMeta,
}));

import { syncSupplierMail } from "@/lib/supplier-mail/sync";

const MAILBOX = "zakupy@mikran.com";
const ids = Array.from({ length: 250 }, (_, i) => `g${i}`);
const meta = (id: string) => ({
  id,
  threadId: `t-${id}`,
  labelIds: ["INBOX"],
  receivedAt: "2026-09-20T10:00:00.000Z",
  snippet: "",
  kind: "supplier",
  from: "Miriam <m@renfert.de>",
  to: MAILBOX,
  subject: "Order confirmation",
  rfcMessageId: `<${id}@renfert.de>`,
  references: [],
  attachments: [],
  bulk: false,
});

describe("synchronizacja Poczty dostawców — limit Gmaila", () => {
  it("przerwana pierwsza synchronizacja zachowuje zapisane porcje, a kolejny przebieg idzie dalej", async () => {
    const saved = new Set<string>();
    m.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (/FROM public.google_mail_connections/.test(sql))
        return { rows: [{ user_id: "u1", google_email: MAILBOX, refresh_token_enc: "x", scope: "https://www.googleapis.com/auth/gmail.readonly" }] };
      if (/FROM public.suppliers/.test(sql)) return { rows: [{ id: "renfert", mails: "m@renfert.de", notes: null, extra_info: null }] };
      if (/SELECT (mailbox, )?synced_at FROM public.supplier_mail_sync/.test(sql))
        return { rows: [{ mailbox: MAILBOX, synced_at: new Date(0) }] };
      if (/SELECT gmail_message_id FROM public.supplier_mail_messages/.test(sql))
        return { rows: [...saved].map((gmail_message_id) => ({ gmail_message_id })) };
      if (/INSERT INTO public.supplier_mail_messages/.test(sql)) {
        saved.add(params[2] as string);
        return { rowCount: 1, rows: [] };
      }
      return { rows: [], rowCount: 0 };
    });
    m.listGmailMessageIds.mockImplementation(async (_t: string, q: string) => (q.startsWith("from:(mailer") ? [] : ids));
    // Limit na minutę w drugiej porcji pierwszego przebiegu.
    let limited = false;
    m.getGmailMessageMeta.mockImplementation(async (_t: string, id: string) => {
      if (id === "g150" && !limited) {
        limited = true;
        throw new Error("Gmail chwilowo ogranicza odczyty z tej skrzynki (limit na minutę)");
      }
      return meta(id);
    });

    const first = await syncSupplierMail({ force: true });
    expect(first.errors).toHaveLength(1);
    expect(saved.size).toBe(100);

    // Kolejna próba po odstępie — bez ponownego pobierania 100 zapisanych.
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 120_000 });
    try {
      m.getGmailMessageMeta.mockClear();
      const second = await syncSupplierMail({ force: true });
      expect(second.errors).toEqual([]);
      expect(saved.size).toBe(250);
      expect(m.getGmailMessageMeta.mock.calls.map(([, id]) => id)).not.toContain("g0");
    } finally {
      vi.useRealTimers();
    }
  });
});
