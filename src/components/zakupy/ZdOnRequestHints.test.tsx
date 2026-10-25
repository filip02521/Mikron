/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const scan = vi.fn();
vi.mock("@/app/actions/zd-estimate", () => ({ actionScanZdOnRequestHints: (...a: unknown[]) => scan(...a) }));
import { ZdOnRequestHints } from "./ZdOnRequestHints";

afterEach(() => {
  cleanup();
  scan.mockReset();
});

const lines = [
  { tw_Id: 1, tw_Symbol: "SZ-80", tw_Nazwa: "Szczotka biała 80mm" },
  { tw_Id: 2, tw_Symbol: "WOSK", tw_Nazwa: "Wosk niebieski" },
];
const hint = (twId: number, extra = {}) => ({ twId, summary: `podsumowanie ${twId}`, deliveries: 1, takenWhole: 1, salesShare: 1, customers: 1, ...extra });

describe("podpowiedzi „na prośbę” dla listy Kreatora", () => {
  it("sprawdza listę; kandydat z przyciskiem „Oznacz”, oznaczony magazynowy z „Zdejmij”", async () => {
    scan.mockResolvedValue({ ok: true, candidates: [hint(1)], stockLike: [hint(2, { customers: 23 })], checked: 2, skipped: 0 });
    const onMark = vi.fn();
    const onClear = vi.fn();
    render(<ZdOnRequestHints lines={lines} supplierName="Bredent" markedTwIds={new Set([2])} onMark={onMark} onClear={onClear} disabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Sprawdź listę (2 towary)" }));
    expect(await screen.findByText("Szczotka biała 80mm")).toBeTruthy();
    expect(scan).toHaveBeenCalledWith({ twIds: [1, 2] });
    fireEvent.click(screen.getByRole("button", { name: "Oznacz na prośbę" }));
    expect(onMark).toHaveBeenCalledWith(1);
    expect(screen.getByText(/Kupuje go 23 klientów/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Zdejmij „na prośbę”" }));
    expect(onClear).toHaveBeenCalledWith(2);
  });

  it("po oznaczeniu kandydat znika z podpowiedzi bez ponownego sprawdzania", async () => {
    scan.mockResolvedValue({ ok: true, candidates: [hint(1)], stockLike: [], checked: 1, skipped: 0 });
    const { rerender } = render(
      <ZdOnRequestHints lines={lines} supplierName={null} markedTwIds={new Set()} onMark={vi.fn()} onClear={vi.fn()} disabled={false} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Sprawdź listę/ }));
    expect(await screen.findByText("Szczotka biała 80mm")).toBeTruthy();
    rerender(<ZdOnRequestHints lines={lines} supplierName={null} markedTwIds={new Set([1])} onMark={vi.fn()} onClear={vi.fn()} disabled={false} />);
    expect(screen.queryByText("Szczotka biała 80mm")).toBeNull();
    expect(screen.getByText(/Wyglądają na „na prośbę”, nieoznaczone \(0\)/)).toBeTruthy();
  });
});
