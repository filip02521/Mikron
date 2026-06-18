import { describe, expect, it, vi } from "vitest";
import { handleProsbaStockSubmitError } from "./prosba-stock-submit-error";
import { PROSBA_STOCK_ACK_REQUIRED_HINT } from "./prosba-stock-check";

describe("handleProsbaStockSubmitError", () => {
  it("otwiera dialog potwierdzenia przy błędzie ack z serwera", () => {
    const onAck = vi.fn();
    const onOther = vi.fn();
    const message = `Stan OK.\n\n${PROSBA_STOCK_ACK_REQUIRED_HINT} lub odśwież.`;

    handleProsbaStockSubmitError(new Error(message), onAck, onOther);

    expect(onAck).toHaveBeenCalledWith(message);
    expect(onOther).not.toHaveBeenCalled();
  });

  it("przekazuje inne błędy do onOtherError", () => {
    const onAck = vi.fn();
    const onOther = vi.fn();

    handleProsbaStockSubmitError(new Error("Błąd walidacji"), onAck, onOther);

    expect(onAck).not.toHaveBeenCalled();
    expect(onOther).toHaveBeenCalledWith("Błąd walidacji");
  });
});
