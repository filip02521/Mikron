/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/app/actions/gmail", () => ({ actionSendZdToSupplier: vi.fn() }));
vi.mock("@/app/actions/zd-send", () => ({ actionSetZdTerminAfterSend: vi.fn(), actionZdSendPlan: vi.fn() }));
vi.mock("@/app/actions/zd-estimate", () => ({
  actionMarkZdAutoProposalSentManually: vi.fn(),
  actionMarkZdEstimateIndividualsGlowne: vi.fn(),
  actionMarkZdEstimateSupplierOrdered: vi.fn(),
}));

import { ZdSendWorkspace, type ZdSendSimulation } from "./ZdSendWorkspace";

beforeEach(() => {
  vi.useFakeTimers();
  URL.createObjectURL = vi.fn(() => "blob:zd");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderWorkspace(simulation: ZdSendSimulation, scheduleChecked = true) {
  render(
    <ZdSendWorkspace
      dokId={1}
      supplierId="s1"
      supplierName="Falcon"
      previewOnly
      gmail={{ email: "zakupy@example.com", signature: "" }}
      toSeed="hurt@example.com"
      subjectSeed="ZD 29/M/10/2026"
      bodySeed={"Dzień dobry,\nw załączniku zamówienie."}
      orderFormKind={null}
      etaDateKey={new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)}
      etaSub="czwartek"
      catalogOrderIds={[]}
      serviceOrderIds={[]}
      glowneDone={false}
      scheduleDone={false}
      scheduleCanMark
      scheduleChecked={scheduleChecked}
      scheduleHint={null}
      previousSend={null}
      manualContact={null}
      simulation={simulation}
      simulatedDocument
      onGlowneMarked={() => undefined}
      onScheduleMarked={() => undefined}
      onUndo={() => undefined}
    />
  );
}

describe("okno wysyłki ZD: czekanie na dokument", () => {
  it("ładowanie z licznikiem, po 30 s plan B, potem gotowy plik i aktywna wysyłka", async () => {
    renderWorkspace("attach_slow");
    expect(screen.getByText("Przygotowuję dokument ZD w Subiekcie")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Czekam na dokument/ })).toHaveProperty("disabled", true);
    expect(screen.queryByText("Trwa dłużej niż zwykle.")).toBeNull();
    await act(async () => vi.advanceTimersByTime(31_000));
    expect(screen.getByText(/31 s, zwykle do 30 s/)).toBeTruthy();
    expect(screen.getByText("Trwa dłużej niż zwykle.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Spróbuj ponownie" })).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(10_000));
    expect(screen.getByText("ZD_29_M_10_2026.pdf")).toBeTruthy();
    expect(screen.getByText("gotowy do wysłania")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Wyślij i ustaw termin/ })).toHaveProperty("disabled", false);
  });

  it("treść zwinięta, edycja i podgląd maila dopiero na żądanie", async () => {
    renderWorkspace("ok");
    expect(screen.queryByLabelText("Treść")).toBeNull();
    expect(screen.queryByText("Tak zobaczy to dostawca")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edytuj treść" }));
    expect((screen.getByLabelText("Treść") as HTMLTextAreaElement).value).toContain("w załączniku zamówienie");
    fireEvent.click(screen.getByRole("button", { name: /Podgląd maila/ }));
    expect(screen.getByText("Tak zobaczy to dostawca")).toBeTruthy();
  });

  it("Subiekt nie oddał wydruku: przyczyna, wgranie własnego PDF, wysyłka zablokowana", async () => {
    renderWorkspace("attach_error");
    await act(async () => vi.advanceTimersByTime(3_000));
    expect(screen.getByText(/Subiekt nie oddał wydruku/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Odśwież z Subiekta" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Wyślij i ustaw termin/ })).toHaveProperty("disabled", true);
  });

  it("bez odpowiedzi o planie dostawcy wysyłka czeka - domyślne „poboczne” nie pominie planu po cichu", async () => {
    renderWorkspace("ok", false);
    await act(async () => vi.advanceTimersByTime(4_000));
    expect(screen.getByText("Sprawdzam plan dostawcy…")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Rodzaj zamówienia" })).toBeNull();
    expect(screen.getByRole("button", { name: /Wyślij i ustaw termin/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Wysłałem ręcznie" })).toHaveProperty("disabled", true);
  });
});
