/**
 * @vitest-environment happy-dom
 */
import { useCallback, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import type { ZdEstimateOptionalColumn } from "@/lib/orders/zd-estimate-prefs";
import { useStableCallback } from "@/hooks/useStableCallback";

const actionRenders = new Map<string, number>();

vi.mock("@/components/zakupy/ZdEstimateRowActions", () => ({
  ZdEstimateRowActions: ({ symbol }: { symbol: string }) => {
    actionRenders.set(symbol, (actionRenders.get(symbol) ?? 0) + 1);
    return <span data-testid={`actions-${symbol}`} />;
  },
}));

const { ZdEstimateTableRow } = await import("./ZdEstimateTableRow");

function line(twId: number): ManualZdEstimateLine {
  return {
    tw_Id: twId,
    tw_Symbol: `S${twId}`,
    tw_Nazwa: `Towar ${twId}`,
    tw_IdGrupa: null,
    grt_Nazwa: "—",
    tw_Stan: 10,
    tw_StanRez: 0,
    dostepne: 10,
    sprzedazOkres: 4,
    wzNiepowiazaneOkres: 0,
    sprzedazDziennie: 0,
    celZapasu: 6,
    celZapasuTracked: 6,
    salesTrackDelta: 0,
    salesTrackReasons: [],
    salesTrackConfidence: 0,
    salesTrackQtyReview: false,
    salesTrackHeldExtraQty: 0,
    salesTrackAllowedExtraQty: 0,
    otwarteZkBezRez: 0,
    otwarteZkZarezerwowane: 0,
    otwarteZd: 0,
    doZamowieniaApi: 0,
    doZamowieniaReczne: 3,
    wkladZk: 0,
  } as ManualZdEstimateLine;
}

const LINES = [line(1), line(2), line(3)];
const COLUMNS: ZdEstimateOptionalColumn[] = ["cover", "available", "sales", "target", "value"];
const SECTION_STARTS = new Set<ZdEstimateOptionalColumn>(["available"]);

/** Uproszczony rodzic jak w kreatorze: per-wiersz wartości + stabilne handlery. */
function Harness() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [overrides, setOverrides] = useState<Record<number, number>>({});

  // Zwykła funkcja (nowa co render) — jak toggleRowSelected w kreatorze.
  const toggleRowSelected = (twId: number) => {
    setSelected((prev) => ({ ...prev, [twId]: !prev[twId] }));
  };
  const handleToggle = useStableCallback(toggleRowSelected);
  const handleOverride = useCallback(
    (twId: number, next: number | null, computed: number) => {
      setOverrides((prev) => {
        const copy = { ...prev };
        if (next == null || Math.trunc(next) === computed) delete copy[twId];
        else copy[twId] = Math.trunc(next);
        return copy;
      });
    },
    []
  );
  const noop = useCallback(() => {}, []);

  return (
    <>
      <input
        aria-label="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <button type="button" onClick={() => handleOverride(2, 9, 3)}>
        override-2
      </button>
      <table>
        <tbody>
          {LINES.map((l, rowIndex) => (
            <ZdEstimateTableRow
              key={l.tw_Id}
              line={l}
              rowIndex={rowIndex}
              virtualized={false}
              showPackagingColumn
              optionalColumns={COLUMNS}
              columnSectionStarts={SECTION_STARTS}
              busy={false}
              mutating={false}
              rowPending={false}
              packagingTrusted
              exclusionsTrusted
              onRequestTrusted
              isSelected={Boolean(selected[l.tw_Id])}
              excluded={false}
              dbExcluded={false}
              dbOnRequest={false}
              softOnRequest={false}
              liftedExtraOnly={false}
              sessionIncluded={false}
              onRequestCanonicalId={l.tw_Id}
              nameHit={undefined}
              packRow={null}
              packLookup={null}
              individualExtra={null}
              individualExtraPieces={0}
              stockNeedReliefPieces={0}
              extraOverlapPieces={0}
              minStockSzt={undefined}
              extrasPolicy="sum"
              overrideZdUnits={overrides[l.tw_Id]}
              reviewAccepted={false}
              onToggleSelected={handleToggle}
              onEditPackaging={noop}
              onEditMinStock={noop}
              onExclude={noop}
              onRestore={noop}
              onMarkOnRequest={noop}
              onClearOnRequest={noop}
              onSessionInclude={noop}
              onOverrideChange={handleOverride}
              onAcceptReview={noop}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}

describe("ZdEstimateTableRow (memo)", () => {
  beforeEach(() => {
    actionRenders.clear();
  });
  afterEach(() => {
    cleanup();
  });

  const counts = () => ["S1", "S2", "S3"].map((s) => actionRenders.get(s) ?? 0);

  it("nie renderuje wierszy przy niezwiązanej zmianie stanu rodzica", () => {
    render(<Harness />);
    expect(counts()).toEqual([1, 1, 1]);
    fireEvent.change(screen.getByLabelText("search"), {
      target: { value: "abc" },
    });
    expect(counts()).toEqual([1, 1, 1]);
  });

  it("zaznaczenie renderuje tylko kliknięty wiersz", () => {
    render(<Harness />);
    act(() => {
      fireEvent.click(screen.getByLabelText("Zaznacz S1"));
    });
    expect(counts()).toEqual([2, 1, 1]);
    expect(
      (screen.getByLabelText("Zaznacz S1") as HTMLInputElement).checked
    ).toBe(true);
  });

  it("nadpisanie Do ZD renderuje tylko edytowany wiersz", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("override-2"));
    expect(counts()).toEqual([1, 2, 1]);
  });
});
