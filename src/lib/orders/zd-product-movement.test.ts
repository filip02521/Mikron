import { describe, expect, it } from "vitest";
import {
  buildZdProductMovement,
  formatZdProductMovementSummary,
  zdMovementRangeFrom,
  zdMovementWindowLabel,
  type ZdMovementSale,
} from "@/lib/orders/zd-product-movement";

const sale = (date: string, pieces: number, kh: string, dokNr = `FS ${date}`): ZdMovementSale => ({
  date,
  dokNr,
  khKey: kh,
  khName: kh,
  pieces,
  rola: "fs",
});

describe("buildZdProductMovement", () => {
  it("1 szt przychodzi i po 3 dniach schodzi do jednego klienta → dostawa „wziął X”, sprzedaż „z dostawy”", () => {
    const m = buildZdProductMovement(
      [
        { date: "2026-09-10", pieces: 1, dokNr: "ZD 44", fzNr: "FZ 101", zdDate: "2026-09-07" },
        { date: "2026-10-20", pieces: 3, dokNr: "ZD 203", fzNr: "FZ 180", zdDate: "2026-10-15" },
      ],
      [sale("2026-09-13", 1, "Kowalski"), sale("2026-10-22", 3, "Nowak"), sale("2026-08-01", 2, "Inny")]
    );
    expect(m.deliveries).toBe(2);
    expect(m.takenWhole).toBe(2);
    const ins = m.events.filter((e) => e.kind === "in");
    expect(ins.map((e) => e.kind === "in" && e.takenBy)).toEqual([
      { name: "Nowak", pieces: 3, days: 2 },
      { name: "Kowalski", pieces: 1, days: 3 },
    ]);
    const outs = m.events.filter((e) => e.kind === "out");
    expect(outs.find((e) => e.kind === "out" && e.khName === "Kowalski")).toMatchObject({ fromDelivery: { fzNr: "FZ 101", days: 3 } });
    expect(outs.find((e) => e.kind === "out" && e.khName === "Inny")).toMatchObject({ fromDelivery: null });
    // Najnowsze pierwsze; ZD liczą odstępy.
    expect(m.events[0]).toMatchObject({ kind: "out", date: "2026-10-22" });
    expect(m.events.filter((e) => e.kind === "zd").map((e) => e.kind === "zd" && e.gapDays)).toEqual([38, null]);
    expect(m.gaps).toEqual([38]);
  });

  it("dostawa rozproszona do wielu klientów nie jest „wzięta w całości”; ZD w drodze bez przyjęcia", () => {
    const m = buildZdProductMovement(
      [
        { date: "2026-09-10", pieces: 10, dokNr: "ZD 1", fzNr: "FZ 1", zdDate: "2026-09-05" },
        { date: "2026-10-25", pieces: 5, dokNr: "ZD 2", fzNr: null, zdDate: "2026-10-24", inTransit: true },
      ],
      [sale("2026-09-12", 3, "A"), sale("2026-09-15", 3, "B"), sale("2026-09-20", 4, "C")]
    );
    expect(m.deliveries).toBe(1);
    expect(m.takenWhole).toBe(0);
    expect(m.events.filter((e) => e.kind === "in")).toHaveLength(1);
    expect(m.events.find((e) => e.kind === "zd" && e.inTransit)).toBeTruthy();
  });

  it("nieregularny rytm: odstępy 14, 46, 90 → mediana 46, nieregularnie", () => {
    const m = buildZdProductMovement(
      [
        { date: "2026-01-05", pieces: 1, dokNr: "a", fzNr: null, zdDate: "2026-01-01" },
        { date: "2026-01-19", pieces: 1, dokNr: "b", fzNr: null, zdDate: "2026-01-15" },
        { date: "2026-03-06", pieces: 1, dokNr: "c", fzNr: null, zdDate: "2026-03-02" },
        { date: "2026-06-04", pieces: 1, dokNr: "d", fzNr: null, zdDate: "2026-05-31" },
      ],
      []
    );
    expect(m.gaps).toEqual([14, 46, 90]);
    expect(m.gapMedian).toBe(46);
    expect(m.irregular).toBe(true);
    expect(formatZdProductMovementSummary(m)).toBe("0 z 4 dostaw wziął w całości jeden klient · ZD co ~46 dni, nieregularnie (14–90)");
  });

  it("bez danych → pusto", () => {
    const m = buildZdProductMovement([], []);
    expect(m.events).toEqual([]);
    expect(formatZdProductMovementSummary(m)).toBeNull();
  });
});

describe("zdMovementRangeFrom", () => {
  it("okno zapasu 30 dni → od dataOd; okno 14 dni → i tak 30 dni; 3m / 12m od dziś; all = bez limitu", () => {
    const today = "2026-10-28";
    expect(zdMovementRangeFrom("window", { dataOd: "2026-09-29", dataDo: "2026-10-28" }, today)).toBe("2026-09-29");
    expect(zdMovementRangeFrom("window", { dataOd: "2026-10-15", dataDo: "2026-10-28" }, today)).toBe("2026-09-29");
    expect(zdMovementRangeFrom("window", { dataOd: "2026-08-01", dataDo: "2026-10-28" }, today)).toBe("2026-08-01");
    expect(zdMovementRangeFrom("window", null, today)).toBe("2026-09-29");
    expect(zdMovementRangeFrom("3m", null, today)).toBe("2026-07-30");
    expect(zdMovementRangeFrom("12m", null, today)).toBe("2025-10-28");
    expect(zdMovementRangeFrom("all", null, today)).toBeNull();
    expect(zdMovementWindowLabel({ dataOd: "2026-09-29", dataDo: "2026-10-28" })).toBe("okno zapasu (30 d)");
    expect(zdMovementWindowLabel({ dataOd: "2026-10-15", dataDo: "2026-10-28" })).toBe("ostatni miesiąc");
  });
});

describe("buildZdProductMovement z zakresem", () => {
  it("sprzedaż sprzed zakresu dopasowuje dostawę z początku zakresu, ale nie trafia na oś; ZD sprzed zakresu znika", () => {
    const m = buildZdProductMovement(
      [
        { date: "2026-10-02", pieces: 2, dokNr: "ZD 29", fzNr: "FZ 1", zdDate: "2026-09-25" },
        { date: "2026-08-10", pieces: 1, dokNr: "ZD 9", fzNr: "FZ 0", zdDate: "2026-08-05" },
      ],
      [sale("2026-09-29", 2, "Klient"), sale("2026-08-12", 1, "Inny")],
      "2026-10-01"
    );
    // ZD 29 jest sprzed zakresu, ale jego przyjęcie w zakresie — zostaje (widać, kiedy zamówiono to, co przyszło).
    expect(m.events.map((e) => `${e.kind}:${e.date}`)).toEqual(["in:2026-10-02", "zd:2026-09-25"]);
    expect(m.events[0]).toMatchObject({ kind: "in", takenBy: { name: "Klient", pieces: 2, days: -3 } });
    expect(m.deliveries).toBe(1);
  });
});
