/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { BoardItem, MailConversation, SupplierMailView } from "@/lib/supplier-mail/data";

const moveMock = vi.fn(async (_input: unknown) => ({ ok: true as const }));
const triageMock = vi.fn(async (_input: unknown) => ({ ok: true as const, pattern: "jan@nowa.example", alsoApplied: 2 }));

vi.mock("@/app/actions/supplier-mail", () => ({
  actionMailBoardMove: (input: unknown) => moveMock(input),
  actionMailBoardSave: vi.fn(async () => ({ ok: true })),
  actionMailTriage: (input: unknown) => triageMock(input),
  actionMailBoardForwardPayment: vi.fn(),
  actionSupplierMailConversation: vi.fn(() => new Promise(() => {})),
  actionSupplierMailRemind: vi.fn(),
  actionSupplierMailReply: vi.fn(),
  // Odświeżenie zwraca ten sam widok — test sprawdza optymistyczne przeniesienie i wywołanie zapisu.
  actionSupplierMailView: vi.fn(async () => ({ ok: false, message: "offline" })),
}));

const { SupplierMailWorkspace } = await import("./SupplierMailWorkspace");

const conv = (over: Partial<MailConversation>): MailConversation => ({
  key: "zakupy@example.com|t1",
  mailbox: "zakupy@example.com",
  threadId: "t1",
  supplierId: null,
  supplierName: "Renfert",
  subject: "Re: order",
  lastFrom: "Miriam",
  lastFromEmail: "m@renfert.example",
  lastAt: "2026-10-08T09:00:00.000Z",
  snippet: "",
  count: 1,
  attachments: 0,
  category: "reply",
  bounce: false,
  autoReply: false,
  open: true,
  zdLabel: null,
  caseKind: null,
  caseId: null,
  linkedBy: null,
  boardThreadId: null,
  handledVia: null,
  ownerUserId: "me",
  repliedAt: null,
  triage: null,
  ...over,
});

const item = (c: MailConversation, over: Partial<BoardItem> = {}): BoardItem => ({
  key: `conv:${c.mailbox}|${c.threadId}`,
  ref: { type: "conv", conv: c },
  column: "todo",
  reason: null,
  fresh: false,
  remindOn: null,
  note: "",
  waitingOn: c.supplierName,
  assigneeId: c.ownerUserId,
  manualColumn: null,
  sortAt: c.lastAt,
  ...over,
});

const view: SupplierMailView = {
  items: [
    item(conv({}), { note: "czekam na proformę" }),
    item(conv({ threadId: "t2", key: "x2", supplierName: "Ivoclar", ownerUserId: "other" })),
    item(conv({ threadId: "t3", key: "x3", supplierName: "Kulzer", category: "invoice", open: false }), { column: "to_pay" }),
  ],
  review: [],
  people: [
    { id: "me", name: "Osoba A." },
    { id: "other", name: "Osoba B." },
  ],
  sync: { at: null, error: null, mailboxes: 1 },
};

function renderBoard(v: SupplierMailView = view) {
  return render(
    <SupplierMailWorkspace
      initialView={v}
      initialMe="zakupy@example.com"
      initialMeId="me"
      initialCanReply
      initialSignature=""
      initialPaymentForwardEmail=""
    />
  );
}

const tab = (name: RegExp) => screen.getByRole("tab", { name });

describe("tablica spraw", () => {
  afterEach(() => {
    cleanup();
    moveMock.mockClear();
  });

  it("Moje pokazuje tylko moje sprawy, Wszystkie — z osobą", () => {
    renderBoard();
    expect(within(tab(/Do zrobienia/)).getByText("1")).toBeTruthy();
    expect(screen.getByText("czekam na proformę")).toBeTruthy();
    expect(screen.queryByText("Ivoclar")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Wszystkie" }));
    expect(within(tab(/Do zrobienia/)).getByText("2")).toBeTruthy();
    expect(screen.getByText("Osoba B.")).toBeTruthy();
  });

  it("upuszczenie na zakładkę przenosi sprawę i zapisuje kolumnę", async () => {
    renderBoard();
    const row = screen.getByText("Renfert").closest("li")!;
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (t: string, v: string) => data.set(t, v),
      getData: (t: string) => data.get(t) ?? "",
      get types() {
        return [...data.keys()];
      },
      effectAllowed: "",
      dropEffect: "",
    };
    fireEvent.dragStart(row, { dataTransfer });
    fireEvent.dragOver(tab(/W trakcie/), { dataTransfer });
    fireEvent.drop(tab(/W trakcie/), { dataTransfer });
    await waitFor(() => expect(moveMock).toHaveBeenCalledWith({ key: "conv:zakupy@example.com|t1", inheritKey: null, column: "doing" }));
    expect(within(tab(/W trakcie/)).getByText("1")).toBeTruthy();
    expect(await screen.findByText("Renfert → W trakcie")).toBeTruthy();
  });

  it("kolumna w szczegółach działa bez przeciągania", async () => {
    renderBoard();
    fireEvent.click(screen.getByText("Renfert"));
    fireEvent.change(screen.getByLabelText("Kolumna"), { target: { value: "waiting" } });
    await waitFor(() => expect(moveMock).toHaveBeenCalledWith(expect.objectContaining({ column: "waiting" })));
  });

  it("półka Do przejrzenia: decyzja z zapamiętaniem nadawcy, potem Cofnij", async () => {
    const stranger = conv({ threadId: "t9", key: "x9", supplierName: "Jan Nowak", lastFromEmail: "jan@nowa.example", triage: "review" });
    renderBoard({ ...view, review: [stranger] });
    fireEvent.click(tab(/Do przejrzenia/));
    fireEvent.click(screen.getByText("Jan Nowak"));
    await new Promise((r) => setTimeout(r, 850)); // przycisk aktywny po chwili (ochrona przed seryjnym klikaniem)
    fireEvent.click(screen.getByRole("button", { name: "To sprawa" }));
    await waitFor(() =>
      expect(triageMock).toHaveBeenCalledWith({ mailbox: "zakupy@example.com", threadId: "t9", decision: "case", remember: "sender" })
    );
    expect(await screen.findByText("Jan Nowak → sprawa · zawsze jan@nowa.example (+2)")).toBeTruthy();
  });
});
