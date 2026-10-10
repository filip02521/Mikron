/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const actions = vi.hoisted(() => ({
  actionUpdateZkWatchFollowUp: vi.fn().mockResolvedValue({}),
  actionUpdateSalesNote: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/app/actions/sales-notepad", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { SalesDayStartItemRow } from "./SalesDayStartItemRow";

afterEach(cleanup);

const item = {
  id: "zk-follow-up-w1",
  source: "zk_follow_up" as const,
  priority: 40,
  title: "Przypomnienie · ZK/1",
  href: "/zk",
  ctaLabel: "Otwórz",
  reminder: { kind: "zk" as const, id: "w1" },
};

describe("SalesDayStartItemRow — przypomnienia", () => {
  it("„Zrobione” czyści przypomnienie ZK i odświeża panel", async () => {
    const onReminderChanged = vi.fn();
    render(<SalesDayStartItemRow item={item} previewHref={(h) => h} onReminderChanged={onReminderChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Zrobione" }));
    await waitFor(() => expect(actions.actionUpdateZkWatchFollowUp).toHaveBeenCalledWith("w1", null));
    await waitFor(() => expect(onReminderChanged).toHaveBeenCalled());
  });

  it("w podglądzie (bez onReminderChanged) nie ma akcji", () => {
    render(<SalesDayStartItemRow item={item} previewHref={(h) => h} />);
    expect(screen.queryByRole("button", { name: "Zrobione" })).toBeNull();
  });
});
