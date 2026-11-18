import { beforeEach, describe, expect, it, vi } from "vitest";

// Prośby zlecenia ZS/26/11/099 (dane wymyślone): A nowa, B w weryfikacji, C zamówiona, D — zakupy zamówiły w międzyczasie.
const rows = [
  { id: "a", product: "Część A", status: "Nowe" },
  { id: "b", product: "Część B", status: "Weryfikacja" },
  { id: "c", product: "Część C", status: "Zamowione" },
  { id: "d", product: "Część D", status: "Nowe" },
];
const sqlCalls: { sql: string; params: unknown[] }[] = [];
const cancelled: { id: string; note: string; opts: unknown }[] = [];

vi.mock("@/lib/db/pool", () => ({
  query: vi.fn(async (sql: string, params: unknown[]) => {
    sqlCalls.push({ sql, params });
    return { rows };
  }),
}));
vi.mock("@/lib/services/orders", () => ({
  batchAddIndividualOrders: vi.fn(),
  cancelIndividualOrder: vi.fn(async (id: string, note: string, opts: unknown) => {
    if (id === "d") throw new Error("Nie można anulować tej prośby - sprawdź status");
    cancelled.push({ id, note, opts });
    return { emailSent: 0 };
  }),
}));

import { cancelUnorderedServiceOrderRequests } from "./service-part-report";

describe("cancelUnorderedServiceOrderRequests", () => {
  beforeEach(() => {
    sqlCalls.length = 0;
    cancelled.length = 0;
  });

  it("anuluje tylko niezamówione prośby tego zlecenia, bez maila; zamówione i zmienione w międzyczasie zostają", async () => {
    const r = await cancelUnorderedServiceOrderRequests("ZS/26/11/099");
    expect(sqlCalls[0]!.params[0]).toBe("Zgłoszenie serwisu: ZS/26/11/099");
    expect(cancelled.map((c) => c.id)).toEqual(["a", "b"]);
    expect(cancelled[0]!.opts).toEqual({ notify: false });
    expect(cancelled[0]!.note).toContain("ZS/26/11/099");
    expect(r).toEqual({
      cancelled: ["Część A", "Część B"],
      kept: [
        { product: "Część C", status: "Zamowione" },
        { product: "Część D", status: "Nowe" },
      ],
    });
  });
});
