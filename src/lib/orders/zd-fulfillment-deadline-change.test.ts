import { describe, expect, it } from "vitest";
import {
  buildZdFulfillmentDeadlineChangeDisplay,
  buildZdFulfillmentDeadlineChangePersistFields,
  isFirstZdFulfillmentDeadlineConfirmation,
  isZdFulfillmentDeadlineChangeVisible,
  pickLatestZdFulfillmentDeadlineChange,
  resolveZdFulfillmentDeadlineChangeDisplay,
  ZD_FULFILLMENT_DEADLINE_CHANGE_VISIBLE_MS,
} from "./zd-fulfillment-deadline-change";

const placementOrder = {
  ordered_at: "2026-06-18T10:00:00+02:00",
  action_at: "2026-06-18T10:00:00+02:00",
  status: "Zamowione" as const,
};

describe("zd-fulfillment-deadline-change", () => {
  it("wykrywa przesunięcie terminu przy sync", () => {
    const fields = buildZdFulfillmentDeadlineChangePersistFields(
      {
        zd_fulfillment_deadline: "2026-07-15",
        zd_fulfillment_previous_deadline: null,
        zd_fulfillment_deadline_changed_at: null,
        zd_fulfillment_deadline_change_seen_at: null,
        ...placementOrder,
      },
      "2026-07-22",
      "2026-06-18T12:00:00Z"
    );
    expect(fields).toEqual({
      zd_fulfillment_previous_deadline: "2026-07-15",
      zd_fulfillment_deadline_changed_at: "2026-06-18T12:00:00Z",
      zd_fulfillment_deadline_change_seen_at: null,
    });
  });

  it("nie zapisuje zmiany przy pierwszym terminie", () => {
    const fields = buildZdFulfillmentDeadlineChangePersistFields(
      {
        zd_fulfillment_deadline: null,
        zd_fulfillment_previous_deadline: null,
        zd_fulfillment_deadline_changed_at: null,
        zd_fulfillment_deadline_change_seen_at: null,
        ...placementOrder,
      },
      "2026-07-22",
      "2026-06-18T12:00:00Z"
    );
    expect(fields.zd_fulfillment_previous_deadline).toBeNull();
    expect(fields.zd_fulfillment_deadline_changed_at).toBeNull();
  });

  it("rozpoznaje pierwsze ustalenie terminu po placeholderze z dnia zamówienia", () => {
    expect(
      isFirstZdFulfillmentDeadlineConfirmation(placementOrder, "2026-06-18")
    ).toBe(true);
    expect(
      isFirstZdFulfillmentDeadlineConfirmation(placementOrder, "2026-07-01")
    ).toBe(false);
  });

  it("pierwsze ustalenie terminu nie pokazuje przesunięcia", () => {
    const display = resolveZdFulfillmentDeadlineChangeDisplay(
      {
        zd_fulfillment_deadline: "2026-07-22",
        zd_fulfillment_previous_deadline: "2026-06-18",
        zd_fulfillment_deadline_changed_at: "2026-06-19T10:00:00Z",
        zd_fulfillment_deadline_change_seen_at: null,
        ...placementOrder,
      },
      new Date("2026-06-19T12:00:00Z")
    );
    expect(display).toMatchObject({
      variant: "first_confirmed",
      title: "Ustalono termin realizacji",
      detail: "Docelowo 22.07.2026",
    });
  });

  it("buduje komunikat przesunięcia i przyspieszenia", () => {
    expect(
      buildZdFulfillmentDeadlineChangeDisplay(
        "2026-07-15",
        "2026-07-22",
        "2026-06-18T12:00:00Z"
      )
    ).toMatchObject({
      title: "Termin przesunięty",
      detail: "Poprzednio 15.07.2026 · teraz 22.07.2026",
      variant: "postponed",
    });

    expect(
      buildZdFulfillmentDeadlineChangeDisplay(
        "2026-07-22",
        "2026-07-15",
        "2026-06-18T12:00:00Z"
      ).variant
    ).toBe("moved_earlier");
  });

  it("ukrywa po potwierdzeniu lub po 7 dniach", () => {
    const order = {
      zd_fulfillment_deadline: "2026-07-22",
      zd_fulfillment_previous_deadline: "2026-07-15",
      zd_fulfillment_deadline_changed_at: "2026-06-10T12:00:00Z",
      zd_fulfillment_deadline_change_seen_at: null,
      ...placementOrder,
    };
    expect(
      isZdFulfillmentDeadlineChangeVisible(order, new Date("2026-06-12T12:00:00Z"))
    ).toBe(true);
    expect(
      isZdFulfillmentDeadlineChangeVisible(order, new Date("2026-06-20T12:00:00Z"))
    ).toBe(false);
    expect(
      resolveZdFulfillmentDeadlineChangeDisplay({
        ...order,
        zd_fulfillment_deadline_change_seen_at: "2026-06-11T10:00:00Z",
      })
    ).toBeNull();
  });

  it("pickLatestZdFulfillmentDeadlineChange wybiera najnowszą zmianę", () => {
    const picked = pickLatestZdFulfillmentDeadlineChange(
      [
        {
          zd_fulfillment_deadline: "2026-07-20",
          zd_fulfillment_previous_deadline: "2026-07-10",
          zd_fulfillment_deadline_changed_at: "2026-06-17T10:00:00Z",
          zd_fulfillment_deadline_change_seen_at: null,
          ...placementOrder,
        },
        {
          zd_fulfillment_deadline: "2026-08-01",
          zd_fulfillment_previous_deadline: "2026-07-25",
          zd_fulfillment_deadline_changed_at: "2026-06-18T10:00:00Z",
          zd_fulfillment_deadline_change_seen_at: null,
          ...placementOrder,
        },
      ],
      new Date("2026-06-18T12:00:00Z")
    );
    expect(picked?.currentDeadline).toBe("2026-08-01");
    expect(ZD_FULFILLMENT_DEADLINE_CHANGE_VISIBLE_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
