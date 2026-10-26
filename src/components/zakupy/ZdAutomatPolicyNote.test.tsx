/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ZdAutomatPolicyBadge } from "./ZdAutomatPolicyNote";
import { ZdAutomatCardSection, ZdBacktestState } from "./ZdAutomatCardSection";
import type { ZdAutomatSupplierRow } from "@/lib/data/zd-automat-suppliers";
import type { ZdBacktestParams } from "@/lib/data/zd-backtest-run";

vi.mock("@/app/actions/zd-estimate", () => ({ actionSaveZdSupplierOrderPolicy: vi.fn() }));
vi.mock("@/app/actions/zd-backtest", () => ({ actionStartZdBacktest: vi.fn(), actionGetZdBacktestRun: vi.fn(async () => null) }));

afterEach(cleanup);

const polkard = { strategy: "max30_90" as const, targetDays: 25, cycleDays: 2, autoProposals: true };

const row = (over: Partial<ZdAutomatSupplierRow> = {}): ZdAutomatSupplierRow => ({
  id: "00000000-0000-4000-8000-000000000001",
  name: "Polkard",
  location: "POLSKA",
  isActive: true,
  hasScope: true,
  subiektCountryId: null,
  subiektCountryName: null,
  policy: { ...polkard, supplierId: "00000000-0000-4000-8000-000000000001", autoLevel: 1, cutoffTime: "14:00", updatedAt: null },
  backtest: {
    status: "done",
    verdict: "works",
    headline: null,
    at: "2026-10-20T10:00:00.000Z",
    params: { cycleDays: 2, targetDays: 25 } as ZdBacktestParams,
    version: 3,
  },
  ...over,
});

describe("Automat ZD przy cyklu z karty", () => {
  it("wiersz Terminów: krótka etykieta z rytmem automatu, pełna w podpowiedzi", () => {
    const { container, getByText } = render(<ZdAutomatPolicyBadge policy={polkard} />);
    expect(getByText("Automat ZD · co 2 dni")).toBeTruthy();
    expect(container.querySelector("[title]")?.getAttribute("title")).toContain("tylko przypomnienia w Terminach zamówień");
  });

  it("karta dostawcy w automacie: rytm, cel, stopień, werdykt backtestu i przyciski ustawień", () => {
    const { getByText, getByRole } = render(<ZdAutomatCardSection row={row()} canManage onChanged={() => {}} />);
    expect(getByText("W automacie · co 2 dni · cel 25 dni zapasu · stopień 1 · Propozycja ZD")).toBeTruthy();
    expect(getByText("co 2 dni · cel 25 d")).toBeTruthy();
    expect(getByRole("button", { name: "Zmień ustawienia" })).toBeTruthy();
    expect(getByRole("button", { name: "Backtest" })).toBeTruthy();
  });

  it("karta dostawcy poza automatem: Włącz automat otwiera backtest (bez osobnego przycisku); bez uprawnień — bez przycisków", () => {
    const classic = row({ policy: { ...row().policy, strategy: "classic", targetDays: null, cycleDays: null, autoLevel: 0 }, backtest: null });
    const { getByText, getByRole, rerender, queryByRole } = render(<ZdAutomatCardSection row={classic} canManage onChanged={() => {}} />);
    expect(getByText("Poza automatem - ZD liczysz w Kreatorze jak dotąd")).toBeTruthy();
    expect(getByText("nie liczony")).toBeTruthy();
    expect(getByRole("button", { name: "Włącz automat" })).toBeTruthy();
    expect(queryByRole("button", { name: "Backtest" })).toBeNull();
    rerender(<ZdAutomatCardSection row={classic} canManage={false} onChanged={() => {}} />);
    expect(queryByRole("button")).toBeNull();
  });

  it("poza automatem i bez zakresu w Kreatorze — zamiast przycisku powód", () => {
    const noScope = row({ hasScope: false, policy: { ...row().policy, strategy: "classic", targetDays: null, cycleDays: null, autoLevel: 0 }, backtest: null });
    const { getByText, queryByRole } = render(<ZdAutomatCardSection row={noScope} canManage onChanged={() => {}} />);
    expect(getByText("Automat i backtest po ustawieniu zakresu w Kreatorze ZD")).toBeTruthy();
    expect(queryByRole("button", { name: "Włącz automat" })).toBeNull();
  });

  it("Włącz automat poza automatem otwiera backtest, który sam dobiera ustawienia", () => {
    const classic = row({ policy: { ...row().policy, strategy: "classic", targetDays: null, cycleDays: null, autoLevel: 0 }, backtest: null });
    const { getByRole, getByText } = render(<ZdAutomatCardSection row={classic} canManage onChanged={() => {}} />);
    fireEvent.click(getByRole("button", { name: "Włącz automat" }));
    expect(getByText("Backtest — Polkard")).toBeTruthy();
    expect(getByText("Teraz poza automatem - ZD liczysz w Kreatorze")).toBeTruthy();
  });

  it("Zmień ustawienia otwiera okno strategii nad panelem karty (warstwa top)", () => {
    const { getByRole, getByText } = render(<ZdAutomatCardSection row={row()} canManage onChanged={() => {}} />);
    fireEvent.click(getByRole("button", { name: "Zmień ustawienia" }));
    expect(getByText("Strategia zamawiania - Polkard")).toBeTruthy();
    expect(document.querySelector('[role="dialog"]')?.className).toContain("z-[71]");
  });

  it("backtest starszy niż 90 dni prosi o ponowne policzenie", () => {
    const now = new Date("2027-02-01T10:00:00.000Z").getTime();
    const { getByText } = render(<ZdBacktestState row={row()} nowMs={now} />);
    expect(getByText("sprzed 104 dni - policz ponownie")).toBeTruthy();
  });
});
