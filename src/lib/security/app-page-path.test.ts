import { describe, expect, it } from "vitest";
import { normalizeSalesBugReportPagePath } from "./app-page-path";

describe("normalizeSalesBugReportPagePath", () => {
  it("akceptuje ścieżki aplikacji", () => {
    expect(normalizeSalesBugReportPagePath("/moje")).toBe("/moje");
    expect(normalizeSalesBugReportPagePath("/zespol/handlowcy")).toBe("/zespol/handlowcy");
  });

  it("odrzuca zewnętrzne URL i traversal", () => {
    expect(normalizeSalesBugReportPagePath("https://evil.test/x")).toBe("/");
    expect(normalizeSalesBugReportPagePath("/../admin")).toBe("/");
    expect(normalizeSalesBugReportPagePath("/unknown/path")).toBe("/");
  });
});
