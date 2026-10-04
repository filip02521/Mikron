import { describe, expect, it } from "vitest";
import { EMPTY_SHIPMENT, lastFreeStorageDay, shipmentAlerts, shipmentStage, type CustomsShipment } from "./customs-shipment";

const s = (patch: Partial<CustomsShipment>): CustomsShipment => ({ ...EMPTY_SHIPMENT, ...patch });

describe("shipmentStage — etap z wpisanych danych", () => {
  it("kolejne etapy", () => {
    expect(shipmentStage(s({}))).toBe("none");
    expect(shipmentStage(s({ transportRef: "784-85993040", eta: "2026-10-01" }))).toBe("in_transit");
    expect(shipmentStage(s({ arrivedAt: "2026-10-02" }))).toBe("at_terminal");
    expect(shipmentStage(s({ arrivedAt: "2026-10-02", dutiesAmount: 87483 }))).toBe("duties_due");
    expect(shipmentStage(s({ arrivedAt: "2026-10-02", dutiesAmount: 87483, dutiesPaidAt: "2026-10-02" }))).toBe(
      "at_terminal"
    );
    expect(shipmentStage(s({ arrivedAt: "2026-10-02", mrn: "26PL44302D00PFUWR5" }))).toBe("cleared");
    expect(shipmentStage(s({ mrn: "X", deliveredAt: "2026-10-05" }))).toBe("delivered");
  });
});

describe("terminy składowania", () => {
  // DHL: „3 dni kalendarzowe liczone od dnia przybycia, włącznie z tym dniem”.
  it("dzień przybycia się wlicza", () => {
    expect(lastFreeStorageDay(s({ arrivedAt: "2026-10-02", freeStorageDays: 3 }))).toBe("2026-10-04");
  });

  it("Upcera przyjęta 02.10: 03.10 jutro ostatni darmowy, 04.10 składowe od jutra, 06.10 naliczane od 05.10", () => {
    const upcera = s({ arrivedAt: "2026-10-02", freeStorageDays: 3 });
    expect(shipmentAlerts(upcera, true, "2026-10-02")[0]).toMatchObject({ tone: "info", text: "Bez składowego do 04.10" });
    expect(shipmentAlerts(upcera, true, "2026-10-03")[0]).toMatchObject({ tone: "warning", text: "Jutro ostatni dzień bez składowego" });
    expect(shipmentAlerts(upcera, true, "2026-10-04")[0]).toMatchObject({
      tone: "danger",
      text: "Składowe od jutra - dziś ostatni dzień bez opłat",
    });
    expect(shipmentAlerts(upcera, true, "2026-10-06")[0]).toMatchObject({ tone: "danger", text: "Składowe naliczane od 05.10" });
  });

  it("dokumenty nie wysłane: ostrzeżenie, a blisko 10. dnia — zwrot do nadawcy", () => {
    const dhl = s({ arrivedAt: "2026-09-29", freeStorageDays: 3 });
    expect(shipmentAlerts(dhl, false, "2026-09-29").map((a) => a.text)).toContain(
      "Dokumenty do odprawy nie wysłane do agencji"
    );
    expect(shipmentAlerts(dhl, false, "2026-10-06").map((a) => a.text)).toContain(
      "Dokumenty nie wysłane - zwrot do nadawcy 09.10"
    );
  });

  it("należności do zapłaty i ETA", () => {
    expect(shipmentAlerts(s({ arrivedAt: "2026-10-02", dutiesAmount: 100 }), true, "2026-10-02").map((a) => a.text)).toContain(
      "Należności do zapłaty - przekaż Darii"
    );
    expect(shipmentAlerts(s({ eta: "2026-11-19", transportRef: "BL" }), true, "2026-10-04")[0]!.text).toBe("ETA 19.11");
    expect(shipmentAlerts(s({ eta: "2026-10-01", transportRef: "BL" }), true, "2026-10-04")[0]!.tone).toBe("warning");
  });

  it("odprawiona / dostarczona — bez alarmów", () => {
    expect(shipmentAlerts(s({ arrivedAt: "2026-09-20", mrn: "X" }), false, "2026-10-04")).toEqual([]);
  });
});
