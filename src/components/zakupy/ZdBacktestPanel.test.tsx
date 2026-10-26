/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, findByRole, render } from "@testing-library/react";
import { ZdBacktestPanel } from "./ZdBacktestPanel";
import type { ZdBacktestResult, ZdBacktestRun } from "@/lib/data/zd-backtest-run";
import type { ZdSupplierOrderPolicyRow } from "@/lib/data/zd-supplier-order-policy";
import type { ZdBacktestMetrics } from "@/lib/orders/zd-backtest";

const getRun = vi.fn();
vi.mock("@/app/actions/zd-estimate", () => ({ actionSaveZdSupplierOrderPolicy: vi.fn() }));
vi.mock("@/app/actions/zd-backtest", () => ({
  actionStartZdBacktest: vi.fn(),
  actionApplyZdBacktestSettings: vi.fn(),
  actionGetZdBacktestRun: (...a: unknown[]) => getRun(...a),
}));

afterEach(cleanup);

const ID = "00000000-0000-4000-8000-000000000001";
const classic: ZdSupplierOrderPolicyRow = {
  supplierId: ID,
  strategy: "classic",
  targetDays: null,
  cycleDays: null,
  autoProposals: false,
  autoLevel: 0,
  cutoffTime: "14:00",
  updatedAt: null,
};
const m = (zeroShare: number, avgStock: number, cost: number): ZdBacktestMetrics => ({
  zeroShare,
  avgStock,
  servedShare: 98,
  orders: 50,
  medianOrder: 800,
  lostMargin: 100,
  cost,
  quarters: [],
  zk: { qty: 0, lateQty: 0, avgDelayDays: null },
});
const result = (over: Partial<ZdBacktestResult> = {}): ZdBacktestResult => ({
  version: 3,
  period: { from: "2025-10-25", to: "2026-10-24" },
  params: { cycleDays: 7, targetDays: 25 },
  reality: { zeroShare: 4, avgStock: 60_000, cycleDays: 14 },
  variants: [
    { key: "kreator", label: "Kreator dziś", settings: "", metrics: m(5, 70_000, 20_000) },
    { key: "automat", label: "Automat", settings: "", metrics: m(2.5, 41_000, 12_000) },
    { key: "pessimistic", label: "Automat, opóźnione dostawy", settings: "", metrics: m(3, 41_000, 13_000) },
  ],
  verdict: { kind: "works", headline: "Najlepiej: ZD co 7 dni, cel 25 dni", reasons: [] },
  grid: [],
  recommended: null,
  searched: { points: 158, cycles: [1, 28], targets: [10, 90] },
  quality: { skus: 100, activeSkus: 80, pricedActiveShare: 100, leadSamples: 30, hiddenOutflowShare: null, pairs: 0, explodedBoms: 0, excluded: 0, onRequest: 0 },
  notes: [],
  ...over,
});
const run = (res: ZdBacktestResult | null, createdAt = new Date().toISOString()): ZdBacktestRun => ({
  id: "r1",
  supplierId: ID,
  status: "done",
  params: res?.params ?? null,
  progress: {},
  result: res,
  error: null,
  createdAt,
  finishedAt: createdAt,
});
const open = (policy: ZdSupplierOrderPolicyRow, r: ZdBacktestRun | null) => {
  getRun.mockResolvedValue({ ok: true, run: r });
  return render(<ZdBacktestPanel supplierId={ID} supplierName="Polkard" policy={policy} canManage onClose={() => {}} onChanged={() => {}} />);
};

describe("panel backtestu — backtest dobiera ustawienia, człowiek tylko włącza", () => {
  it("bez backtestu: bez pól do wpisania, jedna akcja szukania", async () => {
    const { container, getByText } = open(classic, null);
    expect(await findByRole(document.body, "button", { name: "Znajdź najlepsze ustawienia" })).toBeTruthy();
    expect(container.ownerDocument.querySelector("input, select")).toBeNull();
    expect(getByText(/nie ma jeszcze backtestu/)).toBeTruthy();
  });

  it("znalezione ustawienia: odpowiedź z liczbami i włączenie jednym kliknięciem", async () => {
    const { getByText } = open(classic, run(result()));
    expect(await findByRole(document.body, "button", { name: "Włącz automat: ZD co 7 dni, cel 25 dni" })).toBeTruthy();
    expect(getByText("Najlepsze ustawienia")).toBeTruthy();
    expect(getByText("2,5%", { selector: "dd > span" })).toBeTruthy();
    expect(getByText("naprawdę 4,0%")).toBeTruthy();
    expect(getByText("Kreator dziś 20 tys. zł")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/kompromis/i);
  });

  it("w automacie z innymi ustawieniami — przestawienie; z tymi samymi — potwierdzenie bez przycisku", async () => {
    const auto = { ...classic, strategy: "max30_90" as const, cycleDays: 14, targetDays: 40, autoLevel: 1 as const };
    open(auto, run(result()));
    expect(await findByRole(document.body, "button", { name: "Przestaw automat: ZD co 7 dni, cel 25 dni" })).toBeTruthy();
    cleanup();
    const { findByText, queryByRole } = open({ ...auto, cycleDays: 7, targetDays: 25 }, run(result()));
    expect(await findByText("Automat ma już te ustawienia.")).toBeTruthy();
    expect(queryByRole("button", { name: /Przestaw automat|Włącz automat/ })).toBeNull();
  });

  it("wynik sprzed doboru ustawień, za mało danych, stary — bez włączania", async () => {
    open(classic, run(result({ version: 2, params: { cycleDays: 7, targetDays: 25 } })));
    expect(await findByRole(document.body, "button", { name: "Znajdź najlepsze ustawienia" })).toBeTruthy();
    cleanup();
    const insufficient = open(
      classic,
      run(result({ params: null, verdict: { kind: "insufficient", headline: "Za mało danych, żeby dobrać ustawienia", reasons: ["tylko 3 zmierzonych dostaw"] } }))
    );
    expect(await insufficient.findByText("tylko 3 zmierzonych dostaw")).toBeTruthy();
    expect(insufficient.queryByRole("button", { name: /Włącz automat/ })).toBeNull();
    cleanup();
    const stale = open(classic, run(result(), new Date(Date.now() - 100 * 86_400_000).toISOString()));
    expect(await stale.findByText(/Backtest sprzed 100 dni/)).toBeTruthy();
    expect(stale.queryByRole("button", { name: /Włącz automat/ })).toBeNull();
    expect(stale.getByRole("button", { name: "Policz ponownie" })).toBeTruthy();
  });

  it("stary wynik z tymi samymi ustawieniami co automat — ostrzeżenie i główna akcja Policz ponownie", async () => {
    const auto = { ...classic, strategy: "max30_90" as const, cycleDays: 7, targetDays: 25, autoLevel: 1 as const };
    const { findByText, getByRole, queryByText } = open(auto, run(result(), new Date(Date.now() - 100 * 86_400_000).toISOString()));
    expect(await findByText(/Automat ma te ustawienia, ale nie wiadomo, czy dalej są najlepsze/)).toBeTruthy();
    expect(queryByText("Automat ma już te ustawienia.")).toBeNull();
    expect(getByRole("button", { name: "Policz ponownie" }).className).not.toContain("hover:bg-slate-100");
  });
});
