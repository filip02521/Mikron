/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TeethPanelMarkOrderedDialog } from "./TeethPanelMarkOrderedDialog";
import type { TeethMarkOrderedAnalysis } from "@/lib/teeth/teeth-mark-ordered";
import type { TeethMarkPlan } from "@/lib/teeth/teeth-queue-view-model";

afterEach(cleanup);

const analysis: TeethMarkOrderedAnalysis = {
  orderIds: ["a", "b"],
  withSpecIds: ["a", "b"],
  withoutSpecIds: [],
  withoutFileIds: [],
  withoutFileGroupCount: 0,
  hasMissingSpec: false,
  hasMissingFile: false,
  canMarkAny: true,
  selectedPositionCount: 4,
};

// Jedna pozycja listy = jedna klapka (przody 6 / boki 8) — zębów pojedynczo nie sprzedajemy.
const plan: TeethMarkPlan = {
  markCount: 4,
  leftInQueue: 0,
  rows: [
    { orderId: "a", who: "Handlowiec A", context: null, lineLabel: "Ivoclar SR Orthotyp S DCL", marking: 2, open: 2 },
    { orderId: "b", who: "Handlowiec A", context: "Laboratorium Przykład", lineLabel: "Ivoclar SR Vivodent S DCL", marking: 2, open: 2 },
  ],
};

describe("TeethPanelMarkOrderedDialog", () => {
  it("liczy klapki, nie zęby", () => {
    render(
      <TeethPanelMarkOrderedDialog open analysis={analysis} plan={plan} pending={false} onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText("Zaznaczone: 4 klapki.")).toBeTruthy();
    expect(screen.getAllByText("2 klapki")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Oznacz 4 klapki" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/ząb|zęby|zębów/);
  });

  it("odmienia jedną klapkę w przycisku i częściowe zaznaczenie", () => {
    render(
      <TeethPanelMarkOrderedDialog
        open
        analysis={{ ...analysis, selectedPositionCount: 1 }}
        plan={{ markCount: 1, leftInQueue: 5, rows: [{ ...plan.rows[0]!, marking: 1, open: 3 }] }}
        pending={false}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Oznacz 1 klapkę" })).toBeTruthy();
    expect(screen.getByText(/Tylko zaznaczone: 1 klapka\. W kolejce u tego dostawcy zostaje 5 klapek\./)).toBeTruthy();
    expect(screen.getByText("1 z 3 klapek")).toBeTruthy();
  });
});
