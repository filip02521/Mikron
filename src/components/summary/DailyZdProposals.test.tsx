/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/actions/zd-estimate", () => ({
  actionRejectZdAutoProposal: vi.fn(),
  actionAcceptZdAutoProposal: vi.fn(),
  actionCreateZdAutoProposalNow: vi.fn(),
}));

import {
  DailyZdProposalNotice,
  type DailyZdProposal,
} from "./DailyZdProposals";

const proposal = (supplierId: string, supplierName: string): DailyZdProposal => ({
  id: `p-${supplierId}`,
  supplierId,
  supplierName,
  createdAt: "2026-10-21T06:00:00.000Z",
  policy: { strategy: "max30_90", targetDays: 30, cycleDays: 3 },
  dataOd: "2026-09-22",
  dataDo: "2026-10-21",
  lines: [
    { twId: 1, symbol: "A", nazwa: "A", zdUnits: 2, pieces: 200, unitLabel: "op.", priceNet: 1, prosbaPieces: 0, floor: false },
    { twId: 2, symbol: "B", nazwa: "B", zdUnits: 5, pieces: 5, unitLabel: "szt", priceNet: 2, prosbaPieces: 0, floor: false },
  ],
  lineCount: 2,
  valueNet: 210,
  status: "pending",
  decidedAt: null,
  decisionNote: null,
  dokId: null,
  finalLines: null,
  serviceOrderIds: [],
  deferredReason: null,
  flags: [],
  supplierTerms: null,
  origin: "night",
  refreshedAt: null,
  originalLines: null,
  createAttemptedAt: null,
  createOutcomeNote: null,
});

afterEach(cleanup);

describe("DailyZdProposals", () => {
  it("w rozwinięciu wiersza listy dostawców: bez powtórki liczb i bez drugiego Sprawdź i wyślij, Odrzuć zostaje", () => {
    render(<DailyZdProposalNotice proposal={proposal("s1", "Alfa Dental")} hideReview />);
    expect(screen.queryByText("Zamówienie gotowe do potwierdzenia")).toBeNull();
    expect(screen.queryByText(/ok\. 210 zł/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Sprawdź i wyślij" })).toBeNull();
    expect(screen.getByText("205 szt w zamówieniu")).toBeTruthy();
    expect(screen.getByText(/automat co 3 dni/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Odrzuć" })).toBeTruthy();
  });

  it("blok w wierszu: liczby propozycji, cykl automatu i obie akcje", () => {
    render(<DailyZdProposalNotice proposal={proposal("s1", "Alfa Dental")} />);
    expect(screen.getByText("Zamówienie gotowe do potwierdzenia")).toBeTruthy();
    expect(screen.getByText("2 pozycje,")).toBeTruthy();
    expect(screen.getByText("205 szt,")).toBeTruthy();
    expect(screen.getByText(/ok\. 210 zł/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sprawdź i wyślij" }).className).not.toContain("bg-indigo-600");
    expect(screen.getByText(/automat co 3 dni/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sprawdź i wyślij" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Odrzuć" })).toBeTruthy();
    expect(screen.queryByText(/do sprawdzenia/)).toBeNull();
  });

  it("bezpieczniki automatu widać w wierszu", () => {
    const p = proposal("s1", "Alfa Dental");
    p.flags = ["order_value_jump"];
    p.lines[0] = { ...p.lines[0]!, flags: ["peak"] };
    render(<DailyZdProposalNotice proposal={p} />);
    expect(screen.getByText("1 do sprawdzenia · wartość nietypowo wysoka")).toBeTruthy();
  });

  it("prośby handlowców widać w wierszu: pozycje, sztuki i usługi poza listą", () => {
    const p = proposal("s1", "Alfa Dental");
    p.lines[0] = { ...p.lines[0]!, prosbaPieces: 12 };
    p.lines[1] = { ...p.lines[1]!, prosbaPieces: 3 };
    p.serviceOrderIds = ["o-1", "o-2"];
    render(<DailyZdProposalNotice proposal={p} />);
    expect(screen.getByText("na prośbę: 2 pozycje (15 szt) · 2 prośby poza listą (usługi w uwagach ZD)")).toBeTruthy();
  });

  it("bez próśb wiersz nie ma dopisku", () => {
    render(<DailyZdProposalNotice proposal={proposal("s1", "Alfa Dental")} />);
    expect(screen.queryByText(/na prośbę/)).toBeNull();
  });
});
