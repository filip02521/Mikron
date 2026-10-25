/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ZdAutoProposalProsba } from "@/app/actions/zd-estimate";
import { ZdProposalProsbaList, ZdProposalProsbaToggle, zdProsbaPeopleShort } from "./ZdProposalProsby";

vi.mock("@/app/actions/zd-estimate", () => ({}));

afterEach(cleanup);

const req = (over: Partial<ZdAutoProposalProsba> = {}): ZdAutoProposalProsba => ({
  orderId: "o-1",
  salesPersonName: "Anna Nowak",
  qty: 3,
  clientName: "Gabinet Uśmiech",
  zkNumber: "ZK 12/2026",
  note: "pilne na piątek",
  products: "Gips",
  ...over,
});

describe("prośby przy pozycji propozycji", () => {
  it("osoby: do dwóch po imieniu, więcej — liczba handlowców", () => {
    expect(zdProsbaPeopleShort([req(), req({ orderId: "o-2", salesPersonName: "Jan Kos" })])).toBe("Anna Nowak, Jan Kos");
    expect(
      zdProsbaPeopleShort([req(), req({ orderId: "2", salesPersonName: "B" }), req({ orderId: "3", salesPersonName: "C" })])
    ).toBe("3 handlowców");
  });

  it("przełącznik: sztuki na prośbę, przy paczkach z ilu sztuk w ZD, kto prosi; klik zgłasza rozwinięcie", () => {
    const onToggle = vi.fn();
    render(
      <ZdProposalProsbaToggle prosbaPieces={5} linePieces={200} packaged requests={[req()]} open={false} controls="x" onToggle={onToggle} />
    );
    const button = screen.getByRole("button", { expanded: false });
    expect(button.textContent).toContain("na prośbę 5 szt z 200");
    expect(button.textContent).toContain("Anna Nowak");
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("lista: handlowiec, ilość, klient, ZK i notatka; wczytywanie, błąd z ponowieniem, prośby już zamknięte", () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ZdProposalProsbaList id="l" state={null} requests={[]} onRetry={onRetry} />);
    expect(screen.getByText("Wczytuję prośby handlowców…")).toBeTruthy();

    rerender(<ZdProposalProsbaList id="l" state={{ id: "p", status: "error", message: "Brak sesji." }} requests={[]} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(<ZdProposalProsbaList id="l" state={{ id: "p", status: "ok", byTwId: {}, truncated: false }} requests={[]} onRetry={onRetry} />);
    expect(screen.getByText(/nie są już otwarte/)).toBeTruthy();

    rerender(
      <ZdProposalProsbaList id="l" state={{ id: "p", status: "ok", byTwId: {}, truncated: true }} requests={[req()]} onRetry={onRetry} />
    );
    expect(screen.getByText("Anna Nowak")).toBeTruthy();
    expect(screen.getByText("dla Gabinet Uśmiech · ZK 12/2026")).toBeTruthy();
    expect(screen.getByText("„pilne na piątek”")).toBeTruthy();
    expect(screen.getByText(/Lista próśb dostawcy jest niepełna/)).toBeTruthy();
  });
});
