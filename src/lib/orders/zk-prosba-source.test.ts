import { describe, expect, it } from "vitest";
import {
  normalizeZkProsbaSourceInput,
  orderExplicitlyLinkedToZkWatch,
  zkProsbaSourceFromOrder,
} from "./zk-prosba-source";

describe("zk-prosba-source", () => {
  it("normalizuje id karty i numer ZK", () => {
    expect(
      normalizeZkProsbaSourceInput({
        sourceZkWatchId: "  uuid-1  ",
        sourceZkNumber: " ZK/1 ",
      })
    ).toEqual({
      source_zk_watch_id: "uuid-1",
      source_zk_number: "ZK/1",
    });
  });

  it("orderExplicitlyLinkedToZkWatch po id karty", () => {
    expect(
      orderExplicitlyLinkedToZkWatch(
        { source_zk_watch_id: "w1", source_zk_number: null },
        { id: "w1", zk_number: "ZK/9" }
      )
    ).toBe(true);
  });

  it("orderExplicitlyLinkedToZkWatch po numerze ZK", () => {
    expect(
      orderExplicitlyLinkedToZkWatch(
        { source_zk_watch_id: null, source_zk_number: "153157/M/04/2026" },
        { id: "w2", zk_number: "ZK 153157/M/04/2026" }
      )
    ).toBe(true);
  });

  it("nie dopasowuje przy pustym numerze ZK w filtrze", () => {
    expect(
      orderExplicitlyLinkedToZkWatch(
        { source_zk_watch_id: "w1", source_zk_number: "ZK/1" },
        { id: "", zk_number: "" }
      )
    ).toBe(false);
  });

  it("zkProsbaSourceFromOrder kopiuje pola z zamówienia", () => {
    expect(
      zkProsbaSourceFromOrder({
        source_zk_watch_id: "w-9",
        source_zk_number: "ZK/9",
      })
    ).toEqual({
      source_zk_watch_id: "w-9",
      source_zk_number: "ZK/9",
    });
  });
});
