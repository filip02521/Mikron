import { describe, expect, it } from "vitest";
import { detectOnRequestPattern, onRequestDeliveryDate, onRequestPatternSummary } from "./zd-on-request-detect";

const sale = (date: string, khKey: string, pieces: number, khName?: string) => ({ date, khKey, pieces, khName });

describe("wykrywanie towaru na prośbę", () => {
  it("jeden klient bierze całą dostawę w kilka dni od faktury, prawie cała sprzedaż — na prośbę", () => {
    const p = detectOnRequestPattern(
      [
        { date: "2026-07-23", pieces: 25 },
        { date: "2026-03-10", pieces: 10 },
      ],
      [sale("2026-08-03", "1", 25, "GABINET TESTOWY"), sale("2026-03-12", "1", 10, "GABINET TESTOWY"), sale("2026-05-01", "2", 2)]
    );
    expect(p).toMatchObject({ deliveries: 2, takenWhole: 2, customers: 2, likely: true, stockLike: false, topCustomer: "GABINET TESTOWY" });
    expect(p.salesShare).toBeCloseTo(35 / 37);
    expect(onRequestPatternSummary(p)).toBe(
      "2 z 2 dostaw w ciągu 21 dni od faktury wziął w całości jeden klient (najczęściej GABINET TESTOWY) - to 95% sprzedaży."
    );
  });

  it("towar magazynowy: dostawa rozchodzi się na wielu klientów — nie na prośbę, a przy oznaczeniu „jak magazynowy”", () => {
    const sales = Array.from({ length: 12 }, (_, i) => sale(`2026-0${(i % 9) + 1}-15`, String(i), 2));
    const p = detectOnRequestPattern([{ date: "2026-04-10", pieces: 20 }], sales);
    expect(p.likely).toBe(false);
    expect(p.stockLike).toBe(true);
  });

  it("mała dostawa przypadkiem kupiona przez jednego klienta, ale sprzedaż głównie poza dostawami — nie na prośbę", () => {
    const rest = Array.from({ length: 20 }, (_, i) => sale(`2025-1${i % 3}-0${(i % 9) + 1}`, String(100 + i), 1));
    const p = detectOnRequestPattern([{ date: "2026-06-01", pieces: 1 }], [sale("2026-06-05", "9", 1), ...rest]);
    expect(p.takenWhole).toBe(1);
    expect(p.likely).toBe(false);
  });

  it("okno: sprzedaż po 22 dniach i przed −7 dniem nie liczy się do dostawy", () => {
    expect(detectOnRequestPattern([{ date: "2026-06-01", pieces: 5 }], [sale("2026-06-24", "1", 5)]).takenWhole).toBe(0);
    expect(detectOnRequestPattern([{ date: "2026-06-01", pieces: 5 }], [sale("2026-05-24", "1", 5)]).takenWhole).toBe(0);
    expect(detectOnRequestPattern([{ date: "2026-06-01", pieces: 5 }], [sale("2026-05-26", "1", 4)]).takenWhole).toBe(1);
  });

  it("świeża dostawa (okno jeszcze otwarte) nie liczy się przeciw, dopóki nikt jej nie wziął", () => {
    const old = [{ date: "2026-05-01", pieces: 10 }];
    const sales = [sale("2026-05-04", "1", 10, "A")];
    const fresh = { date: "2026-10-20", pieces: 10 };
    expect(detectOnRequestPattern([...old, fresh], sales, "2026-10-24")).toMatchObject({ deliveries: 1, takenWhole: 1, likely: true });
    // bez dnia liczenia (zachowanie dotychczasowe) świeża dostawa obniża udział
    expect(detectOnRequestPattern([...old, fresh], sales).likely).toBe(false);
    // wzięta w całości od razu — liczy się mimo otwartego okna
    expect(
      detectOnRequestPattern([...old, fresh], [...sales, sale("2026-10-22", "1", 10, "A")], "2026-10-24")
    ).toMatchObject({ deliveries: 2, takenWhole: 2 });
  });

  it("bez faktury: data przybliżona ZD + 5 dni", () => {
    expect(onRequestDeliveryDate({ fzDate: "2026-07-09", zdDate: "2026-07-06" })).toBe("2026-07-09");
    expect(onRequestDeliveryDate({ fzDate: null, zdDate: "2026-07-29" })).toBe("2026-08-03");
    expect(onRequestDeliveryDate({ fzDate: null, zdDate: null })).toBeNull();
  });
});
