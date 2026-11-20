/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const listVacations = vi.fn();
const upsertVacation = vi.fn();

vi.mock("@/app/actions/admin", () => ({
  actionListActiveVacationsForSupplier: (...args: unknown[]) => listVacations(...args),
  actionUpsertVacation: (...args: unknown[]) => upsertVacation(...args),
  actionPreviewVacationImpact: vi.fn(async () => ({ preview: null, validationError: null })),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { SupplierVacationModal } from "./SupplierVacationModal";

// Nazwa pola obejmuje też podpowiedź pod nim (jest w <label>), więc dopasowanie po początku.
const dateInput = (label: string) => screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement;

async function renderModal(onSaved = vi.fn()) {
  const view = render(
    <SupplierVacationModal supplierId="s1" supplierName="Alfa Dental" onClose={() => {}} onSaved={onSaved} />
  );
  await waitFor(() => expect(screen.queryByText("Wczytywanie zapisanych urlopów…")).toBeNull());
  return view;
}

describe("SupplierVacationModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("wpisane daty zostają po ponownym renderze od rodzica (odświeżenie panelu)", async () => {
    listVacations.mockResolvedValue({ vacations: [], todayKey: "2026-11-19" });
    const view = await renderModal();
    fireEvent.change(dateInput("Urlop od"), { target: { value: "2026-12-21" } });
    fireEvent.change(dateInput("Urlop do"), { target: { value: "2027-01-06" } });

    // Panel co 25 s renderuje się od nowa i podaje nowe funkcje — okno nie może wczytać urlopów drugi raz.
    view.rerender(
      <SupplierVacationModal supplierId="s1" supplierName="Alfa Dental" onClose={() => {}} onSaved={vi.fn()} />
    );
    await waitFor(() => expect(listVacations).toHaveBeenCalledTimes(1));
    expect(dateInput("Urlop od").value).toBe("2026-12-21");
    expect(dateInput("Urlop do").value).toBe("2027-01-06");
  });

  it("„Urlop od” podpowiada ostatnie zamówienie (dzień roboczy wcześniej), własna data zostaje", async () => {
    listVacations.mockResolvedValue({ vacations: [], todayKey: "2026-11-19" });
    await renderModal();
    fireEvent.change(dateInput("Urlop od"), { target: { value: "2026-12-21" } });
    expect(dateInput("Ostatnie zamówienie przed urlopem").value).toBe("2026-12-18");

    fireEvent.change(dateInput("Urlop od"), { target: { value: "2027-01-07" } });
    expect(dateInput("Ostatnie zamówienie przed urlopem").value).toBe("2027-01-05");

    fireEvent.change(dateInput("Ostatnie zamówienie przed urlopem"), { target: { value: "2026-12-10" } });
    fireEvent.change(dateInput("Urlop od"), { target: { value: "2026-12-22" } });
    expect(dateInput("Ostatnie zamówienie przed urlopem").value).toBe("2026-12-10");
  });

  it("zapis bez dat mówi w oknie, czego brakuje, i nie woła serwera", async () => {
    listVacations.mockResolvedValue({ vacations: [], todayKey: "2026-11-19" });
    await renderModal();
    fireEvent.change(dateInput("Urlop od"), { target: { value: "2026-12-21" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz urlop" }));
    expect(screen.getAllByText("Wpisz datę")).toHaveLength(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(upsertVacation).not.toHaveBeenCalled();
  });

  it("błąd serwera zostaje w oknie, okno się nie zamyka", async () => {
    listVacations.mockResolvedValue({ vacations: [], todayKey: "2026-11-19" });
    upsertVacation.mockRejectedValue(new Error("Ten dostawca ma już aktywny urlop w tym okresie."));
    const onSaved = vi.fn();
    await renderModal(onSaved);
    fireEvent.change(dateInput("Urlop od"), { target: { value: "2026-12-21" } });
    fireEvent.change(dateInput("Urlop do"), { target: { value: "2027-01-06" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz urlop" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("ma już aktywny urlop"));
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("zapisany urlop: odznaczenie zmienia przycisk na „Wyłącz urlop”", async () => {
    listVacations.mockResolvedValue({
      vacations: [{ id: "v1", start_date: "2026-12-21", end_date: "2027-01-06", last_order_date: "2026-12-18", active: true }],
      todayKey: "2026-11-19",
    });
    await renderModal();
    expect(screen.getByRole("button", { name: "Zapisz zmiany" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /Urlop obowiązuje/ }));
    expect(screen.getByRole("button", { name: "Wyłącz urlop" })).toBeTruthy();
  });

  it("nowy urlop nie pokazuje pola „obowiązuje” (zawsze włączony)", async () => {
    listVacations.mockResolvedValue({ vacations: [], todayKey: "2026-11-19" });
    await renderModal();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
