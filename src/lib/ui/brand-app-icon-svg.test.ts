import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { buildBrandAppIconSvg } from "@/lib/ui/brand-app-icon-svg";

describe("ikona OnTime", () => {
  it("app/icon.svg jest wygenerowana z tego samego źródła co znak w aplikacji", () => {
    const file = readFileSync(join(process.cwd(), "src/app/icon.svg"), "utf8");
    expect(file).toBe(buildBrandAppIconSvg());
  });
});
