/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ZdEstimateKeyFactsPanel } from "./ZdEstimateKeyFactsPanel";

afterEach(() => cleanup());

function renderPanel(over: Partial<Parameters<typeof ZdEstimateKeyFactsPanel>[0]> = {}) {
  const onStockDaysChange = vi.fn();
  render(
    <ZdEstimateKeyFactsPanel
      todayKey="2026-11-09"
      scopeMode="grupa"
      scopeName="Falcon"
      supplierId="s1"
      supplierLabel="Falcon"
      computedNextDate="2026-11-23"
      orderOnDemand={false}
      interval={{ unit: "weeks", value: 2 }}
      stockDays={20}
      stockSub="z karty dostawcy"
      onStockDaysChange={onStockDaysChange}
      canEditStock
      listComputed
      leadDays={10}
      dataOd="2026-09-11"
      dataDo="2026-11-09"
      {...over}
    />
  );
  return onStockDaysChange;
}

describe("panel parametrów Kreatora ZD", () => {
  it("pokazuje kolejne zamówienie, interwał, zapas, dostawę i okno; ostrzega, gdy zapas nie starczy", () => {
    const onChange = renderPanel();
    expect(screen.getByText("pn 23.11")).toBeTruthy();
    expect(screen.getByText("za 14 dni")).toBeTruthy();
    expect(screen.getByText("co 2 tyg.")).toBeTruthy();
    expect(screen.getByText("20 dni")).toBeTruthy();
    expect(screen.getByText("~10 dni")).toBeTruthy();
    expect(screen.getByText("11.09–09.11")).toBeTruthy();
    expect(screen.getByRole("link", { name: "karta dostawcy" }).getAttribute("href")).toBe("/zakupy/dostawcy?karta=s1");
    expect(screen.getByText("Zapas 20 dni nie starczy do kolejnej dostawy.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ustaw zapas 24 dni" }));
    expect(onChange).toHaveBeenCalledWith("24");
  });

  it("zmiana zapasu: gotowa wartość, własna liczba z walidacją, skutek podany przed zapisem", () => {
    const onChange = renderPanel({ stockDays: 60 });
    expect(screen.queryByText(/nie starczy/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Zmień" }));
    expect(screen.getByText(/Zmiana czyści policzoną listę/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "90 d" }));
    expect(onChange).toHaveBeenCalledWith("90");
    fireEvent.click(screen.getByRole("button", { name: "Zmień" }));
    const input = screen.getByLabelText("Własna liczba dni");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Ustaw" }));
    expect(screen.getByRole("alert").textContent).toBe("Podaj od 1 do 365 dni.");
    fireEvent.change(input, { target: { value: "75" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("75");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("zaległe zamówienie i dostawca na żądanie", () => {
    renderPanel({ computedNextDate: "2026-11-05" });
    expect(screen.getByText("zaległe")).toBeTruthy();
    expect(screen.getByText("zaległe 4 dni")).toBeTruthy();
    cleanup();
    renderPanel({ orderOnDemand: true });
    expect(screen.getByText("na żądanie")).toBeTruthy();
    expect(screen.getByText("dostawca na żądanie")).toBeTruthy();
    expect(screen.queryByText(/nie starczy/)).toBeNull();
  });

  it("strategia automatu: zapas poniżej jej celu nie jest do wyboru, bo nic by nie zmienił", () => {
    const onChange = renderPanel({ stockDays: 90, stockDaysMin: 90 });
    fireEvent.click(screen.getByRole("button", { name: "Zmień" }));
    expect(screen.queryByRole("button", { name: "60 d" })).toBeNull();
    expect(screen.getByRole("button", { name: "120 d" })).toBeTruthy();
    const input = screen.getByLabelText("Własna liczba dni");
    fireEvent.change(input, { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Ustaw" }));
    expect(screen.getByRole("alert").textContent).toMatch(/co najmniej 90 dni/);
    expect(onChange).not.toHaveBeenCalled();
  });
});
