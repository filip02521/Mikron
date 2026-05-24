import { describe, expect, it } from "vitest";
import { escapeHtml } from "@/lib/security/escape-html";

describe("escapeHtml", () => {
  it("escapes HTML metacharacters", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
  });

  it("leaves plain text unchanged", () => {
    expect(escapeHtml("Produkt ABC 123")).toBe("Produkt ABC 123");
  });
});
