import { describe, expect, it } from "vitest";
import {
  parseHistoriaBrowseTab,
  parseHistoriaSupplierId,
  supplierHistoriaHref,
} from "@/lib/orders/historia-links";

const SID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("parseHistoriaBrowseTab", () => {
  it("akceptuje individual / normal", () => {
    expect(parseHistoriaBrowseTab("individual")).toBe("individual");
    expect(parseHistoriaBrowseTab("normal")).toBe("normal");
  });

  it("odrzuca inne wartości", () => {
    expect(parseHistoriaBrowseTab(null)).toBeNull();
    expect(parseHistoriaBrowseTab("x")).toBeNull();
  });
});

describe("parseHistoriaSupplierId", () => {
  it("akceptuje uuid", () => {
    expect(parseHistoriaSupplierId(SID)).toBe(SID);
    expect(parseHistoriaSupplierId(SID.toUpperCase())).toBe(SID);
  });

  it("odrzuca śmieci", () => {
    expect(parseHistoriaSupplierId("Dental")).toBeNull();
    expect(parseHistoriaSupplierId(null)).toBeNull();
  });
});

describe("supplierHistoriaHref", () => {
  it("buduje URL z tab, supplier i q", () => {
    expect(
      supplierHistoriaHref("individual", { id: SID, name: "Dental Shop" })
    ).toBe(`/historia?tab=individual&supplier=${SID}&q=Dental+Shop`);
    expect(supplierHistoriaHref("normal", { id: SID, name: "Acme" })).toBe(
      `/historia?tab=normal&supplier=${SID}&q=Acme`
    );
  });

  it("pomija puste name", () => {
    expect(supplierHistoriaHref("individual", { id: SID, name: "  " })).toBe(
      `/historia?tab=individual&supplier=${SID}`
    );
  });
});
