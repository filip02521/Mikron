import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  query: vi.fn(),
  getGmailMessageMeta: vi.fn(),
  getGmailThreadId: vi.fn(),
  fetchGmailAttachment: vi.fn(),
}));

vi.mock("@/lib/db/pool", () => ({ query: m.query }));
vi.mock("@/lib/google/gmail", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/google/gmail")>()),
  getGmailOAuthConfig: () => ({ clientId: "c", clientSecret: "s", redirectUri: "r", tokenKey: Buffer.alloc(32) }),
  decryptToken: () => "1//refresh",
  gmailAccessToken: async () => "ya29.token",
  getGmailMessageMeta: m.getGmailMessageMeta,
  getGmailThreadId: m.getGmailThreadId,
  fetchGmailAttachment: m.fetchGmailAttachment,
}));

import { boardReplyAttachment } from "@/lib/google/gmail-connections";

const input = { threadId: "board-1", inquiryId: "inq-1", replyId: "msg-reply", filename: "Oferta Renfert.pdf" };
const meta = (over: Record<string, unknown> = {}) => ({
  id: "msg-reply",
  threadId: "gmail-thread-1",
  labelIds: ["INBOX"],
  attachments: [{ filename: "Oferta Renfert.pdf", attachmentId: "fresh-att-id", size: 1200, mimeType: "application/pdf" }],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.query.mockResolvedValue({
    rows: [
      {
        supplier_name: "Renfert GmbH",
        sent_by: "u1",
        from_address: "filip.naskret@mikran.com",
        gmail_message_id: "msg-sent",
        gmail_thread_id: "gmail-thread-1",
        refresh_token_enc: "v1:x:y:z",
        scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
      },
    ],
  });
  m.fetchGmailAttachment.mockResolvedValue(Buffer.from("%PDF-1.7 oferta"));
});

describe("boardReplyAttachment", () => {
  it("plik z odpowiedzi w wątku zapytania — pobrany świeżym attachmentId", async () => {
    m.getGmailMessageMeta.mockResolvedValue(meta());
    const file = await boardReplyAttachment(input);
    expect(file?.filename).toBe("Oferta Renfert.pdf");
    expect(m.fetchGmailAttachment).toHaveBeenCalledWith("ya29.token", "msg-reply", "fresh-att-id");
  });

  it("wiadomość z innego wątku skrzynki → nic (nie da się pobrać dowolnego maila)", async () => {
    m.getGmailMessageMeta.mockResolvedValue(meta({ threadId: "inny-watek" }));
    expect(await boardReplyAttachment(input)).toBeNull();
    expect(m.fetchGmailAttachment).not.toHaveBeenCalled();
  });

  it("nasza wysłana wiadomość albo brak pliku o tej nazwie → nic", async () => {
    m.getGmailMessageMeta.mockResolvedValue(meta({ labelIds: ["SENT"] }));
    expect(await boardReplyAttachment(input)).toBeNull();
    m.getGmailMessageMeta.mockResolvedValue(meta());
    expect(await boardReplyAttachment({ ...input, filename: "inny.pdf" })).toBeNull();
  });

  it("zapytanie spoza tego wątku tablicy → nic", async () => {
    m.query.mockResolvedValue({ rows: [] });
    expect(await boardReplyAttachment(input)).toBeNull();
    expect(m.getGmailMessageMeta).not.toHaveBeenCalled();
  });
});
