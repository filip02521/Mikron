import { describe, expect, it } from "vitest";
import {
  classifyProsbaLinesByLane,
  procurementSubmitSuccessMessage,
  procurementZamowienieSubmitSuccessMessage,
  prosbaReadinessTargetsTeethPanel,
  TEETH_PROCUREMENT_PANEL_HINT,
  teethSalesOrderedStatusDetail,
} from "./teeth-procurement-flow-copy";
import { toStockExemptTwIdSet } from "@/lib/orders/teeth-stock-exempt";

const exempt = toStockExemptTwIdSet([100]);

describe("teeth-procurement-flow-copy", () => {
  it("klasyfikuje linie prośby wg toru", () => {
    expect(
      classifyProsbaLinesByLane(
        [{ subiektTwId: 100 }, { subiektTwId: 200 }],
        exempt
      )
    ).toEqual({ hasTeeth: true, hasRegular: true });
    expect(classifyProsbaLinesByLane([{ subiektTwId: 100 }], exempt)).toEqual({
      hasTeeth: true,
      hasRegular: false,
    });
  });

  it("komunikat sukcesu dla samego toru zębów", () => {
    const msg = procurementZamowienieSubmitSuccessMessage(2, {
      hasTeeth: true,
      hasRegular: false,
    });
    expect(msg).toContain("panelu zębów");
    expect(msg).toContain(TEETH_PROCUREMENT_PANEL_HINT);
  });

  it("komunikat mieszanych torów", () => {
    const msg = procurementZamowienieSubmitSuccessMessage(3, {
      hasTeeth: true,
      hasRegular: true,
    });
    expect(msg).toContain("panelu zębów");
    expect(msg).toContain("panelu dziennego");
  });

  it("gotowość tylko zębów", () => {
    expect(
      prosbaReadinessTargetsTeethPanel([{ subiektTwId: 100 }], exempt)
    ).toBe(true);
    expect(
      prosbaReadinessTargetsTeethPanel(
        [{ subiektTwId: 100 }, { subiektTwId: 200 }],
        exempt
      )
    ).toBe(false);
  });

  it("status zamówione u labu dla handlowca", () => {
    expect(
      teethSalesOrderedStatusDetail("2026-07-01", "2026-07-15")
    ).toContain("01.07.2026");
    expect(
      teethSalesOrderedStatusDetail("2026-07-01", "2026-07-15")
    ).toContain("15.07.2026");
  });

  it("procurementSubmitSuccessMessage dla informacji", () => {
    expect(
      procurementSubmitSuccessMessage({
        count: 1,
        requestKind: "informacja",
        lanes: { hasTeeth: false, hasRegular: true },
        informacjaStockOutReorder: true,
      })
    ).toContain("brak na stanie");
  });
});
