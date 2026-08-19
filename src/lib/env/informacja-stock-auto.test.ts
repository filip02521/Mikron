import { afterEach, describe, expect, it } from "vitest";
import {
  assertStrictBooleanInput,
  isInformacjaStockAutoEnvEnabled,
  parseInformacjaStockAutoSetting,
  serializeInformacjaStockAutoSetting,
} from "./informacja-stock-auto";

describe("isInformacjaStockAutoEnvEnabled", () => {
  const key = "INFORMACJA_STOCK_AUTO_ENABLED";

  afterEach(() => {
    delete process.env[key];
  });

  it("domyślnie włączone", () => {
    expect(isInformacjaStockAutoEnvEnabled()).toBe(true);
  });

  it("wyłączone dla 0 / false / off / no", () => {
    for (const value of ["0", "false", "off", "no", "FALSE"]) {
      process.env[key] = value;
      expect(isInformacjaStockAutoEnvEnabled()).toBe(false);
    }
  });

  it("włączone dla innych wartości", () => {
    process.env[key] = "1";
    expect(isInformacjaStockAutoEnvEnabled()).toBe(true);
  });
});

describe("parseInformacjaStockAutoSetting", () => {
  it("czyta nowy kształt { enabled }", () => {
    expect(parseInformacjaStockAutoSetting({ enabled: true })).toBe(true);
    expect(parseInformacjaStockAutoSetting({ enabled: false })).toBe(false);
  });

  it("czyta też surowy boolean", () => {
    expect(parseInformacjaStockAutoSetting(true)).toBe(true);
    expect(parseInformacjaStockAutoSetting(false)).toBe(false);
  });

  it("zwraca null dla śmieciowych wartości", () => {
    expect(parseInformacjaStockAutoSetting(null)).toBeNull();
    expect(parseInformacjaStockAutoSetting({ nope: true })).toBeNull();
    expect(parseInformacjaStockAutoSetting("true")).toBeNull();
  });

  it("serializuje do kształtu z enabled", () => {
    expect(serializeInformacjaStockAutoSetting(true)).toEqual({ enabled: true });
  });
});

describe("assertStrictBooleanInput", () => {
  it("akceptuje tylko prawdziwy boolean", () => {
    expect(assertStrictBooleanInput(true)).toBe(true);
    expect(assertStrictBooleanInput(false)).toBe(false);
  });

  it("odrzuca stringi i obiekty truthy", () => {
    for (const value of ["false", "true", "0", "1", {}, null, undefined, 0, 1]) {
      expect(() => assertStrictBooleanInput(value)).toThrow(/boolean/i);
    }
  });
});
