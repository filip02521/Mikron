import { describe, expect, it } from "vitest";
import {
  analyzeSubiektLeadTimes,
  type SubiektPurchaseDoc,
} from "@/lib/orders/subiekt-lead-times";

const zd = (
  dokId: number,
  dataWyst: string,
  extra: Partial<SubiektPurchaseDoc> = {}
): SubiektPurchaseDoc => ({
  dokId,
  typ: 15,
  khId: 100,
  dataWyst,
  dataMag: dataWyst,
  status: 8,
  doDokId: null,
  ...extra,
});

const fz = (dokId: number, dataMag: string, doDokId: number): SubiektPurchaseDoc => ({
  dokId,
  typ: 1,
  khId: 100,
  dataWyst: dataMag,
  dataMag,
  status: 1,
  doDokId,
});

describe("analyzeSubiektLeadTimes", () => {
  it("ZD → FZ: dni robocze od wystawienia ZD do daty magazynowej FZ", () => {
    // pon 2026-09-14 → czw 2026-09-17 = 3 dni robocze
    const { samples } = analyzeSubiektLeadTimes([zd(1, "2026-09-14"), fz(2, "2026-09-17", 1)]);
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({
      placementDate: "2026-09-14",
      deliveryDate: "2026-09-17",
      businessDaysFull: 3,
      dateCorrected: false,
    });
  });

  it("FZ cofnięta na koniec miesiąca → dzień wpisu z numeracji (ZD wprowadzone tuż przed)", () => {
    const docs = [
      zd(10, "2026-09-25"), // zamówienie
      zd(20, "2026-10-02"), // inne ZD wprowadzone 02.10…
      zd(21, "2026-10-02"),
      zd(22, "2026-10-02"),
      fz(23, "2026-09-30", 10), // …a FZ wpisana po nich z datą 30.09
    ];
    const { samples, counts } = analyzeSubiektLeadTimes(docs);
    const s = samples.find((x) => x.zdId === 10)!;
    expect(s.deliveryDate).toBe("2026-10-02");
    expect(s.dateCorrected).toBe(true);
    // pt 25.09 → pt 02.10 = 5 dni roboczych (nie 3 z daty 30.09)
    expect(s.businessDaysFull).toBe(5);
    expect(counts.corrected).toBe(1);
  });

  it("FZ wpisana dzień/weekend po przyjęciu (nie koniec miesiąca) — data magazynowa zostaje", () => {
    const docs = [
      zd(10, "2026-09-14"),
      zd(20, "2026-09-21"), // ZD z poniedziałku wprowadzone przed FZ…
      zd(21, "2026-09-21"),
      zd(22, "2026-09-21"),
      fz(23, "2026-09-18", 10), // …ale towar przyjęty w piątek 18.09
    ];
    const s = analyzeSubiektLeadTimes(docs).samples.find((x) => x.zdId === 10)!;
    expect(s.deliveryDate).toBe("2026-09-18");
    expect(s.dateCorrected).toBe(false);
  });

  it("łańcuch braków: pierwsza dostawa z pierwszej FZ, pełna z ostatniej", () => {
    const docs = [
      zd(1, "2026-09-01"),
      fz(2, "2026-09-03", 1),
      zd(3, "2026-09-03", { doDokId: 1 }), // braki z zam. 01.09
      fz(4, "2026-09-10", 3),
    ];
    const { samples } = analyzeSubiektLeadTimes(docs);
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({
      zdId: 1,
      lastFzId: 4,
      firstDeliveryDate: "2026-09-03",
      deliveryDate: "2026-09-10",
      businessDaysFirst: 2,
      businessDaysFull: 7,
      chainLength: 2,
    });
  });

  it("otwarte braki wstrzymują próbkę; przekierowanie do innego dostawcy to nowe zamówienie", () => {
    const docs = [
      zd(1, "2026-09-01"),
      fz(2, "2026-09-03", 1),
      zd(3, "2026-09-03", { doDokId: 1, status: 6 }), // braki wciąż otwarte
      zd(5, "2026-09-02"),
      zd(6, "2026-09-04", { doDokId: 5, khId: 999 }), // braki zamówione u innego dostawcy
      { ...fz(7, "2026-09-08", 6), khId: 999 },
    ];
    const { samples, counts } = analyzeSubiektLeadTimes(docs);
    expect(samples.map((s) => s.zdId)).toEqual([6]);
    expect(samples[0]!.khId).toBe(999);
    expect(counts.openOrders).toBe(1);
    expect(counts.withoutFz).toBe(1); // ZD 5 zrealizowane bez FZ (reszta poszła gdzie indziej)
  });
});
