/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ZdFulfillmentDateMeta } from "./ZdFulfillmentDateMeta";

const fulfillment = {
  deadline: "2026-07-15",
  dokNr: "ZD/1",
  syncedAt: null,
  source: "zd" as const,
  slots: [
    { deadline: "2026-07-15", dokNr: "ZD/1", count: 1 },
    { deadline: "2026-07-22", dokNr: "ZD/2", count: 1 },
  ],
};
const lines = [
  { product: "Produkt A", zdFulfillment: { deadline: "2026-07-15", dokNr: "ZD/1", syncedAt: null, source: "zd" as const } },
  { product: "Produkt B", zdFulfillment: { deadline: "2026-07-22", dokNr: "ZD/2", syncedAt: null, source: "zd" as const } },
];
const hint = /Najszybsza dostawa: Produkt A/;

describe("ZdFulfillmentDateMeta — podpowiedź przy kilku terminach", () => {
  afterEach(() => cleanup());

  it("zwinięta karta na telefonie (inline) nadal pokazuje podpowiedź", () => {
    render(<ZdFulfillmentDateMeta fulfillment={fulfillment} collapsed inline lines={lines} />);
    expect(screen.getByText(hint)).toBeTruthy();
  });

  it("rozwinięta karta (inline, bez collapsed) nie dubluje podpowiedzi", () => {
    render(<ZdFulfillmentDateMeta fulfillment={fulfillment} inline lines={lines} />);
    expect(screen.queryByText(hint)).toBeNull();
  });
});
