import { describe, expect, it } from "vitest";
import {
  catalogSupplierUnmappedFeedback,
  classifySubiektException,
  getSubiektFeedback,
  notFoundProductFeedback,
} from "./feedback";
import {
  SubiektNetworkError,
  SubiektNotConfiguredError,
  SubiektRequestError,
  SubiektTimeoutError,
} from "./errors";

describe("classifySubiektException", () => {
  it("rozpoznaje brak konfiguracji", () => {
    expect(classifySubiektException(new SubiektNotConfiguredError())).toBe("not_configured");
  });

  it("rozpoznaje timeout", () => {
    expect(classifySubiektException(new SubiektTimeoutError(15000))).toBe("timeout");
  });

  it("rozpoznaje 401", () => {
    expect(classifySubiektException(new SubiektRequestError(401, "Unauthorized"))).toBe(
      "unauthorized"
    );
  });

  it("rozpoznaje 503", () => {
    expect(classifySubiektException(new SubiektRequestError(503, "Error"))).toBe("server_error");
  });

  it("rozpoznaje sieć", () => {
    expect(classifySubiektException(new SubiektNetworkError("fetch failed"))).toBe(
      "unreachable"
    );
  });
});

describe("getSubiektFeedback", () => {
  it("ma tytuł i ton dla not_found_product", () => {
    const f = notFoundProductFeedback("ABC");
    expect(f.code).toBe("not_found_product");
    expect(f.message).toContain("ABC");
    expect(f.tone).toBe("info");
  });

  it("timeout ma ton warning", () => {
    expect(getSubiektFeedback("timeout").tone).toBe("warning");
  });

  it("catalog_supplier_unmapped nie sugeruje braku towaru w Subiekcie", () => {
    const f = catalogSupplierUnmappedFeedback();
    expect(f.code).toBe("catalog_supplier_unmapped");
    expect(f.title).toBe("Brak przypisanego dostawcy");
    expect(f.title).not.toContain("Subiekt");
    expect(f.message).toContain("Subiekcie");
  });
});
