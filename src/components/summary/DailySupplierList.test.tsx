/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const { markOrdered, shiftOrder, listProposals } = vi.hoisted(() => ({ markOrdered: vi.fn(), shiftOrder: vi.fn(), listProposals: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/actions/admin", () => ({ actionMarkOrdered: markOrdered, actionShiftOrder: shiftOrder }));
vi.mock("@/app/actions/zd-estimate", () => ({ actionListZdAutoProposals: listProposals, actionRejectZdAutoProposal: vi.fn() }));
vi.mock("@/components/procurement/SupplierQuickActionsMenu", () => ({ SupplierQuickActionsMenu: () => <button type="button">Więcej akcji</button> }));
vi.mock("@/components/zakupy/ZdAutoProposalSheet", () => ({
  ZdAutoProposalSheet: ({ supplierName }: { supplierName: string }) => <div role="dialog">Panel zamówienia: {supplierName}</div>,
}));

import { DailySupplierList, type DailySupplierBulk } from "./DailySupplierList";
import { SupplierStockSignalsProvider } from "./SupplierStockSignal";
import type { SummaryStandardItem } from "@/lib/orders/summary";
import type { DailySupplierGroup, DailySupplierRow } from "@/lib/orders/daily-supplier-rows";
import type { SupplierSummaryMeta } from "@/lib/orders/summary-workspace";
import type { StockWatchSupplierSignal } from "@/lib/stock-watch/signal";

afterEach(cleanup);

const signal = (over: Partial<StockWatchSupplierSignal> = {}): StockWatchSupplierSignal => ({
  lineCount: 0,
  orderValue: 0,
  unpricedCount: 0,
  criticalCount: 0,
  beforeDeliveryCount: 0,
  mostUrgent: null,
  dniZapasu: 30,
  leadDays: 7,
  nextOrderDate: null,
  nextOrderDays: null,
  dataDo: "2026-11-09",
  computedAt: "2026-10-19T04:30:00.000Z",
  ...over,
});

function row(id: string, name: string, group: DailySupplierGroup, over: Partial<DailySupplierRow> = {}): DailySupplierRow {
  return {
    supplierId: id,
    supplierName: name,
    group,
    sources: ["harmonogram"],
    action: null,
    schedule: null,
    overdueDays: 0,
    automatOrder: null,
    pendingProposal: null,
    automatWarning: false,
    vacationNote: null,
    onVacationNow: false,
    signal: null,
    signalStale: false,
    offPlanCount: 0,
    offPlanNextOrderDate: null,
    zdToday: false,
    requestCount: 0,
    stockOutCount: 0,
    ...over,
  };
}

const meta = (ids: string[]) =>
  Object.fromEntries(
    ids.map((id) => [id, { location: "POLSKA", notes: "Mail", mails: "biuro@alfa.test", extra_info: "" } as unknown as SupplierSummaryMeta])
  ) as Record<string, SupplierSummaryMeta>;

const sched = (id: string, name: string, vacationNote: string | null = null): SummaryStandardItem => ({
  kind: "standard",
  supplierId: id,
  supplierName: name,
  flaggedName: name,
  location: "POLSKA",
  nextDate: new Date("2026-11-10T00:00:00"),
  vacationNote,
  notes: "",
  shift: "",
  status: "",
  sourceSheet: "POLSKA",
  scheduleId: `s-${id}`,
});

function renderList(rows: DailySupplierRow[], known = rows.map((r) => r.supplierId), bulk?: Partial<DailySupplierBulk>) {
  const onOpenSupplier = vi.fn();
  const run = vi.fn((fn: () => unknown) => fn());
  render(
    <DailySupplierList
      rows={rows}
      supplierMeta={meta(known)}
      todayKey="2026-11-10"
      onOpenSupplier={onOpenSupplier}
      onVacation={vi.fn()}
      onEdit={vi.fn()}
      run={run as never}
      isScopePending={() => false}
      bulk={
        bulk
          ? { selected: {}, onToggle: vi.fn(), onSelectAllInScope: vi.fn(), onBulkOrdered: vi.fn(), isBulkPending: false, ...bulk }
          : undefined
      }
    />
  );
  return { onOpenSupplier, run };
}

describe("DailySupplierList", () => {
  it("bez wierszy nie renderuje nic", () => {
    const { container } = render(
      <DailySupplierList
        rows={[]}
        supplierMeta={{}}
        todayKey="2026-11-10"
        onOpenSupplier={() => {}}
        onVacation={() => {}}
        onEdit={() => {}}
        run={vi.fn() as never}
        isScopePending={() => false}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("nagłówek z liczbą dostawców bez Zrobione dziś i nagłówki grup z licznikami", () => {
    renderList([
      row("a", "Alfa Dental", "send", { sources: ["automat"] }),
      row("b", "Beta Frez", "order"),
      row("c", "Gamma Lab", "order"),
      row("d", "Delta Prot", "done", { sources: ["automat"] }),
    ]);
    expect(screen.getByRole("heading", { name: "Dostawcy na dziś" })).toBeTruthy();
    expect(screen.getByText(/3 dostawcy/)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Do wysłania" })).getByText("1")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Do zamówienia" })).getByText("2")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Do przesunięcia" })).toBeNull();
  });

  it("wiersz: nazwa otwiera kartę, odznaka pierwszego źródła, termin, stan", () => {
    const { onOpenSupplier } = renderList([
      row("a", "Alfa Dental", "order", {
        sources: ["harmonogram", "poza-planem"],
        overdueDays: 3,
        signal: signal({ lineCount: 42, criticalCount: 5 }),
      }),
    ]);
    const item = screen.getByRole("listitem");
    fireEvent.click(within(item).getByRole("button", { name: "Alfa Dental" }));
    expect(onOpenSupplier).toHaveBeenCalledWith("a");
    expect(within(item).getByText("Harmonogram")).toBeTruthy();
    expect(within(item).queryByText("Poza planem")).toBeNull();
    expect(within(item).getByText("zaległy 3 dni")).toBeTruthy();
    expect(within(item).getByText("5 pilnych · 42 poz.")).toBeTruthy();
  });

  it("dostawca spoza supplierMeta ma nazwę jako tekst, nie przycisk", () => {
    renderList([row("x", "Omega", "early", { sources: ["poza-planem"], offPlanCount: 3 })], []);
    expect(screen.queryByRole("button", { name: "Omega" })).toBeNull();
    expect(screen.getByText("Omega")).toBeTruthy();
    expect(screen.getByText("3 towary się skończą")).toBeTruthy();
  });

  it.each([
    ["shift", { signal: signal() }, "Stan wystarcza"],
    ["manual", {}, "Brak analizy"],
    ["manual", { signal: signal(), signalStale: true }, "analiza z 19.10"],
    ["manual", { vacationNote: "OSTATNIE_ZAMOWIENIE" }, "Ostatnie zamówienie przed urlopem"],
    ["done", { sources: ["poza-planem"], zdToday: true }, "ZD z dziś"],
    [
      "done",
      {
        sources: ["automat"],
        automatOrder: { supplierId: "a", supplierName: "Alfa Dental", stage: "sent", proposal: { id: "p", createdAt: "2026-11-10T04:30:00.000Z", status: "accepted", lineCount: 1, valueNet: 1, dokNr: "ZD 1" } },
      },
      "Wysłane",
    ],
  ] as const)("stan w grupie %s: %s → %s", (group, over, text) => {
    renderList([row("a", "Alfa Dental", group, over as Partial<DailySupplierRow>)]);
    if (group === "done") fireEvent.click(screen.getByRole("button", { name: /Pokaż \(1\)/ }));
    expect(screen.getAllByText(new RegExp(text)).length).toBeGreaterThan(0);
  });

  it("nieaktualna analiza z pracą pokazuje datę analizy obok stanu", () => {
    renderList([row("a", "Alfa Dental", "order", { signal: signal({ lineCount: 2, orderValue: 300 }), signalStale: true })]);
    expect(screen.getByText("analiza z 19.10")).toBeTruthy();
  });

  it("długa grupa Do zamówienia pokazuje 15 i rozwija się", () => {
    renderList(Array.from({ length: 22 }, (_, i) => row(`o${i}`, `Dostawca ${String(i).padStart(2, "0")}`, "order")));
    const region = screen.getByRole("region", { name: "Do zamówienia" });
    expect(within(region).getAllByRole("listitem")).toHaveLength(15);
    fireEvent.click(within(region).getByRole("button", { name: "Pokaż wszystkie (22) - jeszcze 7" }));
    expect(within(region).getAllByRole("listitem")).toHaveLength(22);
    fireEvent.click(within(region).getByRole("button", { name: "Zwiń listę" }));
    expect(within(region).getAllByRole("listitem")).toHaveLength(15);
  });

  it("Zamów wcześniej pokazuje 6 najpilniejszych, Do przesunięcia 5", () => {
    renderList([
      ...Array.from({ length: 54 }, (_, i) => row(`e${i}`, `Wczesny ${i}`, "early", { sources: ["poza-planem"], offPlanCount: 54 - i })),
      ...Array.from({ length: 9 }, (_, i) => row(`s${i}`, `Przesuwany ${i}`, "shift", { signal: signal() })),
    ]);
    const early = screen.getByRole("region", { name: "Zamów wcześniej" });
    expect(within(early).getAllByRole("listitem")).toHaveLength(6);
    expect(within(early).getByRole("button", { name: "Pokaż wszystkie (54) - jeszcze 48" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Do przesunięcia" })).getAllByRole("listitem")).toHaveLength(5);
  });

  it("Zrobione dziś jest zwinięte", () => {
    renderList([row("a", "Alfa Dental", "done", { sources: ["automat"] })]);
    expect(screen.queryByText("Alfa Dental")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pokaż (1)" }));
    expect(screen.getByText("Alfa Dental")).toBeTruthy();
  });
});

describe("DailySupplierList — szybka akcja", () => {
  const order = (stage: "review" | "send" | "unconfirmed", dokId: number | null = null) => ({
    supplierId: "a",
    supplierName: "Alfa Dental",
    stage,
    proposal: { id: "p1", createdAt: "2026-11-10T04:30:00.000Z", status: "pending" as const, lineCount: 3, valueNet: 2539, dokNr: null, dokId },
  });

  it("Przygotuj ZD prowadzi do Kreatora, z horyzontem dostawy gdy model tak mówi", () => {
    renderList([
      row("a", "Alfa Dental", "order", { action: { kind: "prepareZd", horizon: false } }),
      row("b", "Beta Frez", "early", { action: { kind: "prepareZd", horizon: true }, offPlanCount: 2 }),
    ]);
    const [plain, horizon] = screen.getAllByRole("link", { name: "Przygotuj ZD" }).map((a) => a.getAttribute("href") ?? "");
    expect(plain).toContain("a");
    expect(plain).not.toMatch(/horizon|horyzont|leadTime/i);
    expect(horizon).toContain("b");
    expect(horizon).not.toBe(plain.replace("a", "b"));
  });

  it("bez Kreatora: Pokaż w Braki z filtrem dostawcy", () => {
    renderList([row("a", "Alfa Dental", "order", { action: { kind: "braki" } })]);
    expect(screen.getByRole("link", { name: "Pokaż w Braki" }).getAttribute("href")).toBe("/zakupy/braki?dostawca=a");
  });

  it("Zamówione woła akcję dla tego dostawcy", () => {
    const { run } = renderList([row("a", "Alfa Dental", "manual", { action: { kind: "ordered" } })]);
    fireEvent.click(screen.getByRole("button", { name: "Zamówione" }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(markOrdered).toHaveBeenCalledWith("a");
  });

  it("Przesuń otwiera menu przesunięcia", () => {
    renderList([row("a", "Alfa Dental", "shift", { action: { kind: "shift" }, signal: signal() })]);
    const btn = screen.getByRole("button", { name: /Przesuń/ });
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("Sprawdź i wyślij dociąga propozycję i otwiera jeden panel, także przy dwóch szybkich kliknięciach", async () => {
    let resolve!: (v: unknown) => void;
    listProposals.mockReset();
    listProposals.mockReturnValue(new Promise((r) => (resolve = r)));
    renderList([row("a", "Alfa Dental", "send", { sources: ["automat"], action: { kind: "automat", label: "Sprawdź i wyślij" }, automatOrder: order("review") })]);
    const btn = screen.getByRole("button", { name: "Sprawdź i wyślij" });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(listProposals).toHaveBeenCalledTimes(1);
    resolve({ ok: true, proposals: [{ id: "p1", supplierId: "a", lines: [], flags: [], dokId: null }] });
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Panel zamówienia: Alfa Dental")).toBeTruthy();
  });

  it("błąd wczytania zamówienia jest widoczny w wierszu", async () => {
    listProposals.mockReset();
    listProposals.mockResolvedValue({ ok: false, message: "Brak połączenia z bazą." });
    renderList([row("a", "Alfa Dental", "send", { sources: ["automat"], action: { kind: "automat", label: "Sprawdź" }, automatOrder: order("unconfirmed") })]);
    fireEvent.click(screen.getByRole("button", { name: "Sprawdź" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Brak połączenia z bazą.");
  });

  it("Zrobione dziś i etap send bez ZD nie mają przycisku akcji", () => {
    renderList([row("a", "Alfa Dental", "send", { sources: ["automat"], action: null, automatOrder: order("send") })]);
    expect(within(screen.getByRole("listitem")).queryByRole("button", { name: /Wyślij|Sprawdź/ })).toBeNull();
  });
});

describe("DailySupplierList — rozwinięcie i zbiorcze Zamówione", () => {
  it("strzałka rozwija szczegóły: kontakt, akcje harmonogramu, zdanie o urlopie", () => {
    renderList([
      row("a", "Alfa Dental", "manual", { action: { kind: "ordered" }, schedule: sched("a", "Alfa Dental", "OSTATNIE_ZAMOWIENIE"), vacationNote: "OSTATNIE_ZAMOWIENIE" }),
    ]);
    const toggle = screen.getByRole("button", { name: "Rozwiń szczegóły: Alfa Dental" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("group", { name: "Akcje harmonogramu - Alfa Dental" })).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Zwiń szczegóły: Alfa Dental" }).getAttribute("aria-expanded")).toBe("true");
    const bar = screen.getByRole("group", { name: "Akcje harmonogramu - Alfa Dental" });
    // „Zamówione” jest już akcją wiersza — w szczegółach nie ma drugiego.
    expect(screen.getAllByRole("button", { name: "Zamówione" })).toHaveLength(1);
    expect(within(bar).getByRole("button", { name: /Przesuń/ })).toBeTruthy();
    expect(within(bar).getByRole("button", { name: "Więcej akcji" })).toBeTruthy();
    expect(screen.getByText(/Ostatnie zamówienie przed urlopem \(plan: 10\.11\)/)).toBeTruthy();
    expect(screen.getByText("Polska")).toBeTruthy();
  });

  it("poza planem: w rozwinięciu plan i liczba zagrożonych towarów, bez akcji harmonogramu", () => {
    renderList([
      row("c", "Gamma Lab", "early", { sources: ["poza-planem"], action: { kind: "prepareZd", horizon: true }, offPlanCount: 3, offPlanNextOrderDate: "2026-11-19" }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Rozwiń szczegóły: Gamma Lab" }));
    expect(screen.getByText(/Plan 19\.11 · za 9 dni - zapas nie wystarczy do planowego zamówienia \(3 towary\)/)).toBeTruthy();
    expect(screen.queryByRole("group", { name: /Akcje harmonogramu/ })).toBeNull();
  });

  it("automat: etap i termin wygaśnięcia w rozwinięciu, bez drugiego Sprawdź i wyślij", () => {
    render(
      <DailySupplierList
        rows={[
          row("a", "Alfa Dental", "send", {
            sources: ["automat"],
            action: { kind: "automat", label: "Sprawdź i wyślij" },
            automatOrder: {
              supplierId: "a",
              supplierName: "Alfa Dental",
              stage: "review",
              proposal: { id: "p1", createdAt: "2026-11-09T04:30:00.000Z", status: "pending", lineCount: 3, valueNet: 2539, dokNr: null },
            },
          }),
        ]}
        supplierMeta={meta(["a"])}
        todayKey="2026-11-10"
        automatExpiresBySupplier={{ a: "2026-11-12" }}
        onOpenSupplier={() => {}}
        onVacation={() => {}}
        onEdit={() => {}}
        run={vi.fn() as never}
        isScopePending={() => false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Rozwiń szczegóły: Alfa Dental" }));
    expect(screen.getByText(/do sprawdzenia, czeka od wczoraj · wygasa/)).toBeTruthy();
    expect(screen.getByRole("img", { name: /Etap 1 z 3/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Sprawdź i wyślij" })).toHaveLength(1);
  });

  it("pole wyboru tylko przy wierszach z terminem; Wszystkie zaznacza tylko widoczne", () => {
    const onSelectAllInScope = vi.fn();
    const onToggle = vi.fn();
    renderList(
      [
        ...Array.from({ length: 9 }, (_, i) => row(`m${i}`, `Ręczny ${i}`, "manual", { action: { kind: "ordered" }, schedule: sched(`m${i}`, `Ręczny ${i}`) })),
        row("c", "Gamma Lab", "early", { sources: ["poza-planem"], offPlanCount: 1 }),
      ],
      undefined,
      { onSelectAllInScope, onToggle }
    );
    expect(screen.queryByRole("checkbox", { name: "Zaznacz Gamma Lab" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Zaznacz Ręczny 0" }));
    expect(onToggle).toHaveBeenCalledWith("m0");
    fireEvent.click(screen.getByRole("checkbox", { name: "Zaznacz wszystkie" }));
    expect(onSelectAllInScope).toHaveBeenCalledWith(true, ["m0", "m1", "m2", "m3", "m4"]);
  });

  it("Zamówione (2) pyta o potwierdzenie i ostrzega o pilnych pozycjach Do ZD", () => {
    const onBulkOrdered = vi.fn();
    const rows = [
      row("a", "Alfa Dental", "order", { schedule: sched("a", "Alfa Dental"), signal: signal({ lineCount: 4, criticalCount: 2 }) }),
      row("b", "Beta Frez", "manual", { schedule: sched("b", "Beta Frez") }),
    ];
    render(
      <SupplierStockSignalsProvider signals={{ a: signal({ lineCount: 4, criticalCount: 2 }) }} canPrepareZd>
        <DailySupplierList
          rows={rows}
          supplierMeta={meta(["a", "b"])}
          todayKey="2026-11-10"
          onOpenSupplier={() => {}}
          onVacation={() => {}}
          onEdit={() => {}}
          run={vi.fn() as never}
          isScopePending={() => false}
          bulk={{ selected: { a: true, b: true }, onToggle: vi.fn(), onSelectAllInScope: vi.fn(), onBulkOrdered, isBulkPending: false }}
        />
      </SupplierStockSignalsProvider>
    );
    expect(screen.getAllByRole("listitem").map((li) => within(li).getAllByRole("button")[1]?.textContent)).toEqual(["Alfa Dental", "Beta Frez"]);
    fireEvent.click(screen.getByRole("button", { name: "Zamówione (2)" }));
    expect(onBulkOrdered).not.toHaveBeenCalled();
    expect(screen.getByText(/1 z 2 ma pilne pozycje Do ZD w analizie Braki/)).toBeTruthy();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Zamówione (2)" }));
    expect(onBulkOrdered).toHaveBeenCalledWith(["a", "b"]);
  });
});

describe("DailySupplierList — filtr źródła", () => {
  const rows = [
    row("a", "Alfa Dental", "send", { sources: ["automat", "harmonogram"] }),
    row("b", "Beta Frez", "order", { sources: ["harmonogram"], requestCount: 2, stockOutCount: 1 }),
    row("c", "Gamma Lab", "early", { sources: ["poza-planem"], offPlanCount: 2 }),
    row("d", "Delta Prot", "done", { sources: ["automat"] }),
  ];
  const renderWith = (source: "automat" | "na-zadanie" | null, onSourceChange = vi.fn()) => {
    render(
      <DailySupplierList
        rows={rows}
        supplierMeta={meta(["a", "b", "c", "d"])}
        todayKey="2026-11-10"
        onOpenSupplier={() => {}}
        onVacation={() => {}}
        onEdit={() => {}}
        run={vi.fn() as never}
        isScopePending={() => false}
        source={source}
        onSourceChange={onSourceChange}
      />
    );
    return onSourceChange;
  };

  it("chipy z licznikami bez Zrobione dziś; źródło z zerem nie ma chipa", () => {
    renderWith(null);
    const chips = within(screen.getByRole("group", { name: "Filtr źródła" })).getAllByRole("button");
    expect(chips.map((c) => [c.textContent, c.getAttribute("aria-pressed")])).toEqual([
      ["Wszyscy 3", "true"],
      ["Automat 1", "false"],
      ["Harmonogram 2", "false"],
      ["Poza planem 1", "false"],
    ]);
  });

  it("wybrane źródło zostawia tylko jego wiersze i grupy", () => {
    const onSourceChange = renderWith("automat");
    expect(screen.getByRole("region", { name: "Do wysłania" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Do zamówienia" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Zamów wcześniej" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Wszyscy/ }));
    expect(onSourceChange).toHaveBeenCalledWith(null);
  });

  it("filtr na źródło bez wierszy działa jak brak filtra", () => {
    renderWith("na-zadanie");
    expect(screen.getByRole("button", { name: /Wszyscy/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("region")).toHaveLength(4);
  });

  it("prośby i sygnały braku mają osobne liczniki, każdy prowadzi do swojej sekcji", () => {
    renderWith(null);
    expect(screen.getByRole("link", { name: "2 prośby" }).getAttribute("href")).toBe("#kolejka-prosby");
    expect(screen.getByRole("link", { name: "1 sygnał braku" }).getAttribute("href")).toBe("#kolejka-brak-na-stanie");
  });

  it("pod listą jest przejście do pełnej listy braków", () => {
    renderWith(null);
    expect(screen.getByRole("link", { name: "Wszystkie braki" }).getAttribute("href")).toBe("/zakupy/braki");
  });
});

describe("DailySupplierList — poprawki po przeglądzie", () => {
  it("pojedyncze Zamówione przy pilnych pozycjach Do ZD pyta o potwierdzenie; bez pilnych działa od razu", () => {
    markOrdered.mockClear();
    renderList([
      row("a", "Alfa Dental", "manual", { action: { kind: "ordered" }, schedule: sched("a", "Alfa Dental"), signal: signal({ lineCount: 4, criticalCount: 2 }), signalStale: true }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Zamówione" }));
    expect(markOrdered).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/2 pilne pozycje Do ZD w analizie Braki/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Zamówione" }));
    expect(markOrdered).toHaveBeenCalledWith("a");
  });

  it("Zamówione w szczegółach wiersza Do zamówienia też pyta przy pilnych pozycjach", () => {
    markOrdered.mockClear();
    renderList([
      row("a", "Alfa Dental", "order", { action: { kind: "prepareZd", horizon: false }, schedule: sched("a", "Alfa Dental"), signal: signal({ lineCount: 4, criticalCount: 1 }) }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Rozwiń szczegóły: Alfa Dental" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Akcje harmonogramu - Alfa Dental" })).getByRole("button", { name: "Zamówione" }));
    expect(markOrdered).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("wiersz z zamówieniem automatu nie ma pola wyboru i nie wchodzi do Wszystkie", () => {
    const onSelectAllInScope = vi.fn();
    renderList(
      [
        row("a", "Alfa Dental", "send", { sources: ["automat", "harmonogram"], schedule: sched("a", "Alfa Dental") }),
        row("b", "Beta Frez", "manual", { schedule: sched("b", "Beta Frez") }),
      ],
      undefined,
      { onSelectAllInScope }
    );
    expect(screen.queryByRole("checkbox", { name: "Zaznacz Alfa Dental" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Zaznacz wszystkie" }));
    expect(onSelectAllInScope).toHaveBeenCalledWith(true, ["b"]);
  });

  it("zwinięcie grupy zdejmuje zaznaczenie z wierszy, które znikają", () => {
    const onSelectAllInScope = vi.fn();
    renderList(
      Array.from({ length: 9 }, (_, i) => row(`m${i}`, `Ręczny ${i}`, "manual", { schedule: sched(`m${i}`, `Ręczny ${i}`) })),
      undefined,
      { selected: { m1: true, m7: true }, onSelectAllInScope }
    );
    fireEvent.click(screen.getByRole("button", { name: /Pokaż wszystkie \(9\)/ }));
    fireEvent.click(screen.getByRole("button", { name: "Zwiń listę" }));
    expect(onSelectAllInScope).toHaveBeenCalledWith(false, ["m7"]);
  });
});

describe("DailySupplierList — nagłówek bez szumu", () => {
  it("z chipami filtra nagłówek nie powtarza liczby z „Wszyscy N”; przy aktywnym filtrze pokazuje liczbę po filtrze", () => {
    const rows = [
      row("a", "Alfa Dental", "send", { sources: ["automat"] }),
      row("b", "Beta Frez", "order", { sources: ["harmonogram"] }),
      row("c", "Gamma Lab", "order", { sources: ["harmonogram"] }),
    ];
    const common = {
      rows,
      supplierMeta: meta(["a", "b", "c"]),
      todayKey: "2026-11-10",
      onOpenSupplier: () => {},
      onVacation: () => {},
      onEdit: () => {},
      run: vi.fn() as never,
      isScopePending: () => false,
      onSourceChange: vi.fn(),
    };
    const { rerender } = render(<DailySupplierList {...common} source={null} />);
    expect(screen.queryByText(/3 dostawcy/)).toBeNull();
    expect(screen.getByRole("button", { name: /Wszyscy 3/ })).toBeTruthy();
    rerender(<DailySupplierList {...common} source="harmonogram" />);
    expect(screen.getByText(/2 dostawcy/)).toBeTruthy();
  });

  it("zbiorcze Zamówione pojawia się dopiero z zaznaczeniem", () => {
    const rows = [row("b", "Beta Frez", "manual", { schedule: sched("b", "Beta Frez") })];
    renderList(rows, undefined, {});
    expect(screen.getByRole("checkbox", { name: "Zaznacz wszystkie" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Zamówione \(/ })).toBeNull();
    cleanup();
    renderList(rows, undefined, { selected: { b: true } });
    expect(screen.getByRole("button", { name: "Zamówione (1)" })).toBeTruthy();
  });
});

describe("DailySupplierList — poprawki po audycie kodu", () => {
  it("zaznaczony dostawca, którego wiersz stracił pole wyboru (doszło zamówienie automatu), nie wchodzi do zbiorczego Zamówione", () => {
    const onBulkOrdered = vi.fn();
    renderList(
      [
        row("a", "Alfa Dental", "send", { sources: ["automat", "harmonogram"], schedule: sched("a", "Alfa Dental") }),
        row("b", "Beta Frez", "manual", { schedule: sched("b", "Beta Frez") }),
      ],
      undefined,
      { selected: { a: true, b: true }, onBulkOrdered }
    );
    fireEvent.click(screen.getByRole("button", { name: "Zamówione (1)" }));
    expect(onBulkOrdered).toHaveBeenCalledWith(["b"]);
  });

  it("termin z ZD z dziś: stan „ZD z dziś”, Zamówione bez pytania mimo pilnych pozycji", () => {
    markOrdered.mockClear();
    renderList([
      row("a", "Alfa Dental", "order", { action: { kind: "ordered" }, zdToday: true, schedule: sched("a", "Alfa Dental"), signal: signal({ lineCount: 4, criticalCount: 2 }) }),
    ]);
    expect(screen.getByText("ZD z dziś")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Zamówione" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(markOrdered).toHaveBeenCalledWith("a");
  });
});
