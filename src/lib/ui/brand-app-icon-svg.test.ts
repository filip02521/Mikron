import { describe, expect, it } from "vitest";
import { buildBrandAppIconSvg, brandAppIconDataUri } from "./brand-app-icon-svg";

describe("brand-app-icon-svg", () => {
  it("zawiera monogram OT i gradient marki", () => {
    const svg = buildBrandAppIconSvg();
    expect(svg).toContain(">OT<");
    expect(svg).toContain("#4f46e5");
    expect(svg).toContain("#0284c7");
    expect(svg).toContain('viewBox="0 0 32 32"');
  });

  it("data URI jest poprawnie zakodowany", () => {
    expect(brandAppIconDataUri()).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });
});
