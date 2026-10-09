/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { SalesZkWatch } from "@/types/database";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/actions/sales-notepad", () => ({
  actionAttachZkWatchNoteToOpenProsba: vi.fn(),
  actionUpdateZkWatchIncludeNoteInProsba: vi.fn(),
  actionUpdateZkWatchNote: vi.fn(),
  actionUpdateZkWatchLineChecks: vi.fn(),
}));

const { ZkWatchLinesModal } = await import("./ZkWatchLinesModal");

const watch: SalesZkWatch = {
  id: "w1",
  sales_person_id: "sp1",
  subiekt_dok_id: 1,
  zk_number: "ZK 565/M/08/2026",
  client_label: "Klinika Przykładowa",
  client_kh_id: 42,
  amount_net: null,
  amount_gross: 140,
  zk_issued_at: "2026-08-05T10:00:00Z",
  note: null,
  line_summary: null,
  line_checks: [],
  subiekt_snapshot: { kh__Kontrahent_Odbiorca: { kh_Id: 42, adr_Telefon: "600-100-200," } },
  follow_up_at: null,
  closed_at: null,
  archived_at: null,
  created_at: "",
  updated_at: "",
} as SalesZkWatch;

describe("podgląd ZK", () => {
  afterEach(() => cleanup());

  it("bez ikonek „?” przy sekcjach, telefon bez przecinka z Subiekta", () => {
    render(<ZkWatchLinesModal watch={watch} open onClose={() => undefined} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: /O tej sekcji|Wyjaśnienie/ })).toBeNull();
    expect(within(dialog).getByRole("link", { name: "600-100-200" })).toBeTruthy();
  });

  it("pusta notatka: jedno zdanie i przycisk, który otwiera pole i wraca po Anuluj", () => {
    render(<ZkWatchLinesModal watch={watch} open onClose={() => undefined} />);
    expect(screen.getAllByText("Brak notatki.")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Dodaj notatkę" }));
    expect(screen.getByRole("button", { name: "Zapisz notatkę" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(screen.getByRole("button", { name: "Dodaj notatkę" })).toBeTruthy();
  });

  it("w podglądzie tylko do odczytu: bez przycisku i bez instrukcji odsyłających na kartę", () => {
    render(<ZkWatchLinesModal watch={watch} open readOnly onClose={() => undefined} />);
    expect(screen.queryByRole("button", { name: "Dodaj notatkę" })).toBeNull();
    expect(screen.queryByText(/Użyj przycisku na karcie ZK/)).toBeNull();
  });
});
