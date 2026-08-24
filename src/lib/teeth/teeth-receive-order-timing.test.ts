import { describe, expect, it } from "vitest";
import {
  formatTeethReceiveBlockTimingLine,
  formatTeethReceiveOrderTimingLine,
  resolveTeethReceiveBlockTimingDisplay,
  resolveTeethReceiveOrderTiming,
  teethReceiveBlockHasMixedTiming,
} from "./teeth-receive-order-timing";

describe("resolveTeethReceiveOrderTiming", () => {
  it("bierze action_at jako prośbę i teeth_ordered_at jako zamówienie", () => {
    expect(
      resolveTeethReceiveOrderTiming({
        action_at: "2026-03-10T09:00:00+01:00",
        ordered_at: "2026-03-18T11:00:00+01:00",
        teeth_ordered_at: "2026-03-18T11:00:00+01:00",
        status: "Zamowione",
      })
    ).toEqual({
      submittedIso: "2026-03-10T09:00:00+01:00",
      orderedIso: "2026-03-18T11:00:00+01:00",
      submittedLabel: "10.03.2026",
      orderedLabel: "18.03.2026",
    });
  });

  it("fallback ordered_at gdy brak teeth_ordered_at", () => {
    const timing = resolveTeethReceiveOrderTiming({
      action_at: "2026-03-10T09:00:00+01:00",
      ordered_at: "2026-03-15T08:00:00+01:00",
      teeth_ordered_at: null,
      status: "Zamowione",
    });
    expect(timing.orderedLabel).toBe("15.03.2026");
  });
});

describe("formatTeethReceiveOrderTimingLine", () => {
  it("składa obie daty", () => {
    expect(
      formatTeethReceiveOrderTimingLine({
        submittedIso: "a",
        orderedIso: "b",
        submittedLabel: "10.03.2026",
        orderedLabel: "18.03.2026",
      })
    ).toBe("Prośba 10.03.2026 · Zamówiono 18.03.2026");
  });

  it("pokazuje tylko dostępną datę", () => {
    expect(
      formatTeethReceiveOrderTimingLine({
        submittedIso: "a",
        orderedIso: null,
        submittedLabel: "10.03.2026",
        orderedLabel: null,
      })
    ).toBe("Prośba 10.03.2026");
  });
});

describe("formatTeethReceiveBlockTimingLine", () => {
  it("gdy daty wspólne — bez „od”", () => {
    expect(
      formatTeethReceiveBlockTimingLine([
        {
          action_at: "2026-03-10T09:00:00+01:00",
          ordered_at: "2026-03-18T11:00:00+01:00",
          teeth_ordered_at: "2026-03-18T11:00:00+01:00",
          status: "Zamowione",
        },
        {
          action_at: "2026-03-10T12:00:00+01:00",
          ordered_at: "2026-03-18T14:00:00+01:00",
          teeth_ordered_at: "2026-03-18T14:00:00+01:00",
          status: "Zamowione",
        },
      ])
    ).toBe("Prośba 10.03.2026 · Zamówiono 18.03.2026");
  });

  it("gdy daty różne — „od” najstarszej", () => {
    expect(
      formatTeethReceiveBlockTimingLine([
        {
          action_at: "2026-03-12T09:00:00+01:00",
          ordered_at: "2026-03-20T11:00:00+01:00",
          teeth_ordered_at: "2026-03-20T11:00:00+01:00",
          status: "Zamowione",
        },
        {
          action_at: "2026-03-08T09:00:00+01:00",
          ordered_at: "2026-03-15T11:00:00+01:00",
          teeth_ordered_at: "2026-03-15T11:00:00+01:00",
          status: "Zamowione",
        },
      ])
    ).toBe("Prośba od 08.03.2026 · Zamówiono od 15.03.2026");
  });
});

describe("teethReceiveBlockHasMixedTiming", () => {
  it("false gdy jedna prośba lub te same dni", () => {
    expect(
      teethReceiveBlockHasMixedTiming([
        {
          action_at: "2026-03-10T09:00:00+01:00",
          ordered_at: "2026-03-18T11:00:00+01:00",
          teeth_ordered_at: "2026-03-18T11:00:00+01:00",
          status: "Zamowione",
        },
      ])
    ).toBe(false);
    expect(
      teethReceiveBlockHasMixedTiming([
        {
          action_at: "2026-03-10T09:00:00+01:00",
          ordered_at: "2026-03-18T11:00:00+01:00",
          teeth_ordered_at: "2026-03-18T11:00:00+01:00",
          status: "Zamowione",
        },
        {
          action_at: "2026-03-10T18:00:00+01:00",
          ordered_at: "2026-03-18T20:00:00+01:00",
          teeth_ordered_at: "2026-03-18T20:00:00+01:00",
          status: "Zamowione",
        },
      ])
    ).toBe(false);
  });

  it("true gdy różnią się dni prośby lub zamówienia", () => {
    expect(
      teethReceiveBlockHasMixedTiming([
        {
          action_at: "2026-03-10T09:00:00+01:00",
          ordered_at: "2026-03-18T11:00:00+01:00",
          teeth_ordered_at: "2026-03-18T11:00:00+01:00",
          status: "Zamowione",
        },
        {
          action_at: "2026-03-12T09:00:00+01:00",
          ordered_at: "2026-03-18T11:00:00+01:00",
          teeth_ordered_at: "2026-03-18T11:00:00+01:00",
          status: "Zamowione",
        },
      ])
    ).toBe(true);
  });
});

describe("resolveTeethReceiveBlockTimingDisplay", () => {
  it("oznacza „od” tylko dla mieszanych pól", () => {
    expect(
      resolveTeethReceiveBlockTimingDisplay([
        {
          action_at: "2026-03-12T09:00:00+01:00",
          ordered_at: "2026-03-18T11:00:00+01:00",
          teeth_ordered_at: "2026-03-18T11:00:00+01:00",
          status: "Zamowione",
        },
        {
          action_at: "2026-03-08T09:00:00+01:00",
          ordered_at: "2026-03-18T14:00:00+01:00",
          teeth_ordered_at: "2026-03-18T14:00:00+01:00",
          status: "Zamowione",
        },
      ])
    ).toEqual({
      submittedLabel: "08.03.2026",
      orderedLabel: "18.03.2026",
      submittedFrom: true,
      orderedFrom: false,
    });
  });
});
