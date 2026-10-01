import { describe, expect, it } from "vitest";
import {
  procurementNestedRowMeta,
  procurementRequestCardBodyClass,
  procurementRequestCardFooterClass,
  procurementRequestContextMetaClass,
  procurementRequestContextStripClass,
  procurementRequestExpandProductsClass,
  procurementRequestLineInOrderBodyClass,
  procurementRequestOrderBodyClass,
  procurementRequestOrderBodyFlatClass,
  procurementRequestOrderBodyInteractiveClass,
  procurementRequestProductTitleClass,
  procurementRequestRowClassName,
  procurementSupplierBlockFooterClass,
  procurementSupplierNameLinkClass,
} from "@/components/summary/procurement-request-row-styles";

describe("procurement request card zone classes", () => {
  it("exposes context strip and order body class tokens", () => {
    expect(procurementRequestContextStripClass).toContain("flex-wrap");
    expect(procurementRequestContextMetaClass).toContain("flex-wrap");
    expect(procurementRequestOrderBodyClass).toContain("rounded-md");
    expect(procurementRequestOrderBodyClass).toContain("flex-col");
    expect(procurementRequestOrderBodyFlatClass).not.toContain("rounded-md");
    expect(procurementRequestLineInOrderBodyClass).toContain("border-0");
    expect(procurementRequestExpandProductsClass).toContain("w-full");
  });

  it("exposes card body/footer stack classes", () => {
    expect(procurementRequestCardBodyClass).toContain("px-2.5");
    expect(procurementRequestCardFooterClass).toContain("px-2.5");
    expect(procurementSupplierBlockFooterClass).toContain("px-2.5");
  });

  it("highlights expandable cards and products on group hover", () => {
    expect(procurementRequestRowClassName({ variant: "prosby", expandable: true })).toContain(
      "cursor-pointer"
    );
    expect(procurementRequestRowClassName({ variant: "prosby", expandable: true })).toContain(
      "hover:border-indigo-300/80"
    );
    expect(procurementRequestOrderBodyInteractiveClass("prosby")).toContain(
      "group-hover/panelRow:bg-indigo-50/55"
    );
    expect(procurementRequestProductTitleClass("stockOut")).toContain(
      "group-hover/panelRow:text-amber-950"
    );
    expect(procurementSupplierNameLinkClass("prosby")).toContain("hover:text-indigo-700");
    expect(procurementSupplierNameLinkClass("stockOut")).toContain("hover:text-amber-800");
  });

  it("builds nested row meta with note suffix", () => {
    expect(
      procurementNestedRowMeta({
        countLabel: "2 produkty",
        locationLabel: "Główne",
        noteSuffix: "· uwagi przy produktach",
      })
    ).toBe("2 produkty · Główne · uwagi przy produktach");

    expect(
      procurementNestedRowMeta({
        countLabel: "1 produkt",
        noteSuffix: null,
      })
    ).toBe("1 produkt");
  });
});
