/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/actions/zd-estimate", () => ({
  actionListZdAutoProposals: vi.fn(),
  actionRejectZdAutoProposal: vi.fn(),
  actionAcceptZdAutoProposal: vi.fn(),
  actionCreateZdAutoProposalNow: vi.fn(),
  actionGetZdAutoProposalProsby: vi.fn(),
}));

import { DailyZdAutomatOrders } from "./DailyZdAutomatOrders";
import type { ZdAutomatTodayOrder } from "@/lib/orders/zd-automat-daily";

const TODAY = "2026-10-28";
const order = (id: string, stage: ZdAutomatTodayOrder["stage"], extra: Partial<ZdAutomatTodayOrder["proposal"]> = {}): ZdAutomatTodayOrder => ({
  supplierId: `s-${id}`,
  supplierName: `Dostawca ${id}`,
  stage,
  proposal: { id, createdAt: `${TODAY}T04:30:00.000Z`, status: "pending", lineCount: 2, valueNet: 1860, dokNr: null, ...extra },
});

afterEach(cleanup);

describe("DailyZdAutomatOrders — akcja i opis etapu", () => {
  it("każdy etap ma swoją akcję; wysłane i odrzucone bez akcji", () => {
    render(
      <DailyZdAutomatOrders
        todayKey={TODAY}
        expiresBySupplier={{ "s-a": "2026-11-02" }}
        orders={[
          order("a", "review"),
          order("b", "unconfirmed", { createAttemptedAt: `${TODAY}T08:00:00.000Z` }),
          order("c", "send", { status: "accepted", dokId: 12, dokNr: "ZD 12/2026" }),
          order("f", "send", { status: "accepted", dokId: null }),
          order("d", "sent", { status: "accepted", dokNr: "ZD 13/2026", mailSentAt: `${TODAY}T08:14:00.000Z` }),
          order("e", "rejected", { status: "rejected" }),
        ]}
      />
    );
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Sprawdź i wyślij", "Sprawdź", "Wyślij mail"]);
    expect(screen.getByText("do sprawdzenia · wygasa pn 02.11")).toBeTruthy();
    expect(screen.getByText(/ZD 12\/2026 w Subiekcie/)).toBeTruthy();
    expect(screen.getByText("ZD 13/2026 · wysłane do dostawcy 09:14")).toBeTruthy();
    expect(screen.getByText("odrzucona")).toBeTruthy();
    expect(screen.getAllByText(/2 pozycje/)).toHaveLength(6);
  });
});
