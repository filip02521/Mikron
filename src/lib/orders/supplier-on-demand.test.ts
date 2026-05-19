import { describe, expect, it } from "vitest";
import {
  detectOrderOnDemandFromFields,
  hasOrderOnDemandMarker,
  isSupplierOrderOnDemand,
  resolveOrderOnDemandForSave,
  suggestOrderOnDemandAfterFieldChange,
} from "./supplier-on-demand";

describe("supplier-on-demand", () => {
  it("wykrywa marker w polach arkusza", () => {
    expect(hasOrderOnDemandMarker("W RAZIE POTRZEBY")).toBe(true);
    expect(hasOrderOnDemandMarker("2 MIESIĄCE")).toBe(false);
    expect(
      detectOrderOnDemandFromFields({
        stock_raw: "W RAZIE POTRZEBY",
        interval_raw: "2 MIESIĄCE",
      })
    ).toBe(true);
    expect(
      detectOrderOnDemandFromFields({
        extra_info: "w razie potrzeby",
      })
    ).toBe(true);
  });

  it("wykrywa z pól mimo order_on_demand=false w DB (przed backfillem)", () => {
    expect(
      isSupplierOrderOnDemand({
        order_on_demand: false,
        stock_raw: "W RAZIE POTRZEBY",
      })
    ).toBe(true);
  });

  it("zapisuje flagę z checkboxa lub wykrycia w polach", () => {
    expect(
      resolveOrderOnDemandForSave({
        order_on_demand: false,
        stock_raw: "W RAZIE POTRZEBY",
        interval_raw: "",
        extra_info: "",
      })
    ).toBe(true);
    expect(
      resolveOrderOnDemandForSave({
        order_on_demand: false,
        stock_raw: "2 MIESIĄCE",
        interval_raw: "2 MIESIĄCE",
        extra_info: "",
      })
    ).toBe(false);
  });

  it("suggestOrderOnDemandAfterFieldChange — marker zaznacza", () => {
    expect(
      suggestOrderOnDemandAfterFieldChange(false, {
        stock_raw: "W RAZIE POTRZEBY",
        interval_raw: "",
        extra_info: "",
      })
    ).toBe(true);
  });
});
