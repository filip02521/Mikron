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
  DailyZdProposalsProvider,
  useDailyZdProposalsOutside,
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
});

function Outside({ scheduled }: { scheduled: string[] }) {
  const list = useDailyZdProposalsOutside(scheduled);
  return <p data-testid="outside">{list.map((p) => p.supplierName).join(",")}</p>;
}

afterEach(cleanup);

describe("DailyZdProposals", () => {
  it("poza harmonogramem są tylko propozycje dostawców bez terminu dziś / zaległego", () => {
    render(
      <DailyZdProposalsProvider proposals={[proposal("s1", "Polkard"), proposal("s2", "Inny")]}>
        <Outside scheduled={["s1"]} />
      </DailyZdProposalsProvider>
    );
    expect(screen.getByTestId("outside").textContent).toBe("Inny");
  });

  it("blok w wierszu: liczby propozycji, cykl automatu i obie akcje", () => {
    render(<DailyZdProposalNotice proposal={proposal("s1", "Polkard")} />);
    expect(screen.getByText("Zamówienie gotowe do potwierdzenia")).toBeTruthy();
    expect(screen.getByText(/2 pozycje · 205 szt · ok\. 210 zł/)).toBeTruthy();
    expect(screen.getByText(/automat co 3 dni/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sprawdź i zatwierdź" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Odrzuć" })).toBeTruthy();
  });
});
