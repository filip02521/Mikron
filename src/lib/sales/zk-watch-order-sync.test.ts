import { describe, expect, it } from "vitest";
import {
  buildClientLabelIlikeOrFilter,
  dedupeWatchIds,
  escapeIlikePattern,
  shouldFetchNullKhCompanionWatches,
  shouldSyncZkWatchLineChecksAfterDeliveryChange,
} from "./zk-watch-order-sync";

describe("shouldSyncZkWatchLineChecksAfterDeliveryChange", () => {
  it("sync po dostawie", () => {
    expect(
      shouldSyncZkWatchLineChecksAfterDeliveryChange(
        "Zamowione",
        "Zrealizowane",
        "0",
        "2"
      )
    ).toBe(true);
  });

  it("sync po cofnięciu do Zamowione", () => {
    expect(
      shouldSyncZkWatchLineChecksAfterDeliveryChange(
        "Zrealizowane",
        "Zamowione",
        "2",
        "0"
      )
    ).toBe(true);
  });

  it("sync gdy zmienia się delivered_quantity bez zmiany statusu dostawy", () => {
    expect(
      shouldSyncZkWatchLineChecksAfterDeliveryChange(
        "Zamowione",
        "Zamowione",
        "1",
        "2"
      )
    ).toBe(true);
  });

  it("pomija gdy brak zmiany statusu dostawy i ilości", () => {
    expect(
      shouldSyncZkWatchLineChecksAfterDeliveryChange(
        "Zamowione",
        "Weryfikacja",
        "0",
        "0"
      )
    ).toBe(false);
  });
});

describe("sync query helpers", () => {
  it("shouldFetchNullKhCompanionWatches wymaga kh i nazwy klienta", () => {
    expect(shouldFetchNullKhCompanionWatches(42, "Klinika")).toBe(true);
    expect(shouldFetchNullKhCompanionWatches(42, null)).toBe(false);
    expect(shouldFetchNullKhCompanionWatches(null, "Klinika")).toBe(false);
  });

  it("buildClientLabelIlikeOrFilter składa tokeny nazwy klienta", () => {
    expect(buildClientLabelIlikeOrFilter("Klinika Smile")).toBe(
      "client_label.ilike.%klinika%,client_label.ilike.%smile%"
    );
    expect(buildClientLabelIlikeOrFilter("   ")).toBeNull();
  });

  it("escapeIlikePattern chroni znaki specjalne", () => {
    expect(escapeIlikePattern("100%_test")).toBe("100\\%\\_test");
  });

  it("dedupeWatchIds usuwa duplikaty", () => {
    expect(dedupeWatchIds(["a", "b", "a"])).toEqual(["a", "b"]);
  });
});
