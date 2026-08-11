import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/orders/resolve-sales-person-email", () => ({
  resolveSalesPersonEmailById: vi.fn(),
}));

vi.mock("@/lib/services/email", () => ({
  sendBoardQuestionReplyEmail: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSalesPersonEmailById } from "@/lib/orders/resolve-sales-person-email";
import { sendBoardQuestionReplyEmail } from "@/lib/services/email";
import { notifyBoardQuestionReplyToSales } from "@/lib/department-board/notify-board-reply";

describe("notifyBoardQuestionReplyToSales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(),
    } as never);
  });

  it("pomija pustą odpowiedź", async () => {
    const res = await notifyBoardQuestionReplyToSales({
      threadId: "t1",
      salesPersonId: "sp1",
      questionTitle: "Pytanie",
      replyBody: "   ",
    });
    expect(res).toEqual({ emailSent: false, skippedReason: "empty_reply" });
    expect(sendBoardQuestionReplyEmail).not.toHaveBeenCalled();
  });

  it("pomija gdy brak e-maila handlowca", async () => {
    vi.mocked(resolveSalesPersonEmailById).mockResolvedValue(null);
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    vi.mocked(createAdminClient).mockReturnValue({ from } as never);

    const res = await notifyBoardQuestionReplyToSales({
      threadId: "t1",
      salesPersonId: "sp1",
      createdByProfileId: "profile-1",
      questionTitle: "Pytanie",
      replyBody: "Tak, jest na stanie",
    });
    expect(res).toEqual({ emailSent: false, skippedReason: "missing_sales_email" });
    expect(sendBoardQuestionReplyEmail).not.toHaveBeenCalled();
  });

  it("używa fallbacku z profilu autora gdy brak sales_person_id", async () => {
    vi.mocked(resolveSalesPersonEmailById)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        personId: "sp-fallback",
        email: "anna@firma.pl",
        name: "Anna",
      });
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { sales_person_id: "sp-fallback" },
          }),
        }),
      }),
    });
    vi.mocked(createAdminClient).mockReturnValue({ from } as never);
    vi.mocked(sendBoardQuestionReplyEmail).mockResolvedValue({ ok: true, id: "msg-2" });

    const res = await notifyBoardQuestionReplyToSales({
      threadId: "t1",
      salesPersonId: null,
      createdByProfileId: "profile-1",
      questionTitle: "Q",
      replyBody: "A",
    });

    expect(res).toEqual({ emailSent: true });
    expect(sendBoardQuestionReplyEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "anna@firma.pl", recipientName: "Anna" })
    );
  });

  it("wysyła e-mail z treścią odpowiedzi", async () => {
    vi.mocked(resolveSalesPersonEmailById).mockResolvedValue({
      personId: "sp1",
      email: "jan@firma.pl",
      name: "Jan Kowalski",
    });
    vi.mocked(sendBoardQuestionReplyEmail).mockResolvedValue({ ok: true, id: "msg-1" });

    const res = await notifyBoardQuestionReplyToSales({
      threadId: "t1",
      salesPersonId: "sp1",
      questionTitle: "Termin dostawy?",
      questionBody: "Kiedy będzie X?",
      productSymbol: "ABC",
      productName: "Produkt X",
      replyBody: "W czwartek.",
    });

    expect(res).toEqual({ emailSent: true });
    expect(sendBoardQuestionReplyEmail).toHaveBeenCalledWith({
      to: "jan@firma.pl",
      recipientName: "Jan Kowalski",
      threadId: "t1",
      questionTitle: "Termin dostawy?",
      questionBody: "Kiedy będzie X?",
      productSymbol: "ABC",
      productName: "Produkt X",
      replyBody: "W czwartek.",
    });
  });

  it("zwraca error gdy SMTP zawiedzie (bez throw)", async () => {
    vi.mocked(resolveSalesPersonEmailById).mockResolvedValue({
      personId: "sp1",
      email: "jan@firma.pl",
      name: "Jan",
    });
    vi.mocked(sendBoardQuestionReplyEmail).mockResolvedValue({
      ok: false,
      error: "Resend down",
      to: "jan@firma.pl",
    });

    const res = await notifyBoardQuestionReplyToSales({
      threadId: "t1",
      salesPersonId: "sp1",
      questionTitle: "Q",
      replyBody: "A",
    });

    expect(res).toEqual({ emailSent: false, error: "Resend down" });
  });
});
