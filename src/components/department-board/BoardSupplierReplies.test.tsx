/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BoardSupplierReplies } from "./BoardSupplierReplies";

const m = vi.hoisted(() => ({ replies: vi.fn() }));

vi.mock("@/app/actions/department-board-inquiry", () => ({
  actionBoardInquiryReplies: m.replies,
  actionSuggestBoardAnswerFromSupplier: vi.fn(),
}));

const found = {
  ok: true as const,
  aiAvailable: false,
  items: [
    {
      inquiryId: "inq-1",
      supplierName: "Renfert GmbH",
      sentAt: "2026-10-06T08:00:00.000Z",
      resolvedAt: null,
      gmailUrl: null,
      status: "read" as const,
      replies: [
        {
          id: "msg-1",
          kind: "supplier" as const,
          from: "Anna Schmidt <a.schmidt@renfert.de>",
          at: "2026-10-07T09:12:00.000Z",
          snippet: "Lead time 2 weeks",
          attachments: [],
          text: "Lead time 2 weeks, price 41.20 EUR.",
        },
      ],
    },
  ],
};

afterEach(cleanup);

describe("BoardSupplierReplies", () => {
  it("znaleziona odpowiedź: kolejne otwarcie wątku i odświeżenie tablicy bez Gmaila, ponownie tylko po kliknięciu", async () => {
    m.replies.mockResolvedValue(found);
    const first = render(<BoardSupplierReplies threadId="board-cache-1" onUseAnswer={() => undefined} refreshKey="a" />);
    await screen.findByText("Dostawca Renfert GmbH odpisał");
    expect(m.replies).toHaveBeenCalledTimes(1);
    first.unmount();

    // Ponowne rozwinięcie + nowa wiadomość w Poczcie (inny refreshKey) — bez odczytu, z podpowiedzią.
    render(<BoardSupplierReplies threadId="board-cache-1" onUseAnswer={() => undefined} refreshKey="b" />);
    expect(screen.getByText("Dostawca Renfert GmbH odpisał")).toBeTruthy();
    expect(screen.getByText("Dostawca dopisał coś nowego.")).toBeTruthy();
    expect(m.replies).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Sprawdź ponownie w Gmailu" }));
    await waitFor(() => expect(m.replies).toHaveBeenCalledTimes(2));
  });

  it("dopóki odpowiedzi nie ma — każde otwarcie wątku sprawdza Gmaila", async () => {
    m.replies.mockReset();
    m.replies.mockResolvedValue({ ...found, items: [{ ...found.items[0]!, replies: [] }] });
    const first = render(<BoardSupplierReplies threadId="board-cache-2" onUseAnswer={() => undefined} />);
    await waitFor(() => expect(m.replies).toHaveBeenCalledTimes(1));
    first.unmount();
    render(<BoardSupplierReplies threadId="board-cache-2" onUseAnswer={() => undefined} />);
    await waitFor(() => expect(m.replies).toHaveBeenCalledTimes(2));
  });
});
