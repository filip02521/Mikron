/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ZdFulfillmentDateMeta } from "./ZdFulfillmentDateMeta";

const fulfillment = {
  deadline: "2099-07-15",
  dokNr: "ZD/1",
  syncedAt: null,
  source: "zd" as const,
  slots: [
    { deadline: "2099-07-15", dokNr: "ZD/1", count: 1 },
    { deadline: "2099-07-22", dokNr: "ZD/2", count: 1 },
  ],
};
const lines = [
  { product: "Produkt A", zdFulfillment: { deadline: "2099-07-15", dokNr: "ZD/1", syncedAt: null, source: "zd" as const } },
  { product: "Produkt B", zdFulfillment: { deadline: "2099-07-22", dokNr: "ZD/2", syncedAt: null, source: "zd" as const } },
];

describe("ZdFulfillmentDateMeta — zwinięta karta", () => {
  afterEach(() => cleanup());

  it("pokazuje najpóźniejszy termin (całość), znacznik z ZD i bez numeru ZD", () => {
    render(<ZdFulfillmentDateMeta fulfillment={fulfillment} collapsed lines={lines} />);
    expect(screen.getByText(/22\.07\.2099/)).toBeTruthy();
    expect(screen.queryByText(/15\.07\.2099/)).toBeNull();
    expect(screen.getByText("z ZD · całość")).toBeTruthy();
    expect(screen.queryByText("ZD/1")).toBeNull();
  });

  it("pozycje bez terminu jako krótka plakietka zamiast zdania", () => {
    render(
      <ZdFulfillmentDateMeta
        fulfillment={{ ...fulfillment, slots: [fulfillment.slots[0]!] }}
        collapsed
        inline
        lines={[lines[0]!, { product: "Produkt C", zdFulfillment: null, zdEtaNoMatch: true }]}
      />
    );
    expect(screen.getByText("1 z 2 bez terminu")).toBeTruthy();
  });

  it("rozwinięta karta (bez collapsed) dalej pokazuje oba terminy z numerami ZD", () => {
    render(<ZdFulfillmentDateMeta fulfillment={fulfillment} inline lines={lines} />);
    expect(screen.getByText("ZD/1")).toBeTruthy();
    expect(screen.getByText("ZD/2")).toBeTruthy();
  });
});
