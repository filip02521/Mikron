import { describe, expect, it } from "vitest";
import {
  clientNamesSummary,
  clientNamesSummaryFromLines,
  formatDeliveryEmailLine,
  formatInformacjaEmailLine,
  normalizeSalesClientAssignment,
  normalizeSalesClientKhId,
  normalizeSalesClientName,
} from "./sales-client-label";

describe("sales-client-label", () => {
  it("normalizeSalesClientName obcina i nulluje puste", () => {
    expect(normalizeSalesClientName("  Firma   ABC  ")).toBe("Firma ABC");
    expect(normalizeSalesClientName("")).toBeNull();
    expect(normalizeSalesClientName(null)).toBeNull();
  });

  it("normalizeSalesClientKhId wymaga nazwy klienta", () => {
    expect(normalizeSalesClientKhId("Klinika", 42)).toBe(42);
    expect(normalizeSalesClientKhId(null, 42)).toBeNull();
    expect(normalizeSalesClientKhId("Klinika", 0)).toBeNull();
  });

  it("normalizeSalesClientAssignment spina nazwę i kh_Id", () => {
    expect(
      normalizeSalesClientAssignment({ clientName: " Klinika ", clientKhId: 12.9 })
    ).toEqual({ clientName: "Klinika", clientKhId: 12 });
    expect(
      normalizeSalesClientAssignment({ clientName: "", clientKhId: 12 })
    ).toEqual({ clientName: null, clientKhId: null });
  });

  it("formatDeliveryEmailLine z klientem", () => {
    const line = formatDeliveryEmailLine(
      {
        supplier: { name: "Dostawca X" },
        products: "Wkręt",
        symbol: "A",
        sales_client_name: "Kowalski",
      },
      "Dostarczone w całości"
    );
    expect(line).toContain("Dla klienta: Kowalski");
    expect(line).toContain("Dostawca X");
    expect(line).toContain("Wkręt");
  });

  it("formatDeliveryEmailLine bez klienta", () => {
    expect(
      formatDeliveryEmailLine(
        { supplier: { name: "D" }, products: "P", symbol: "-", sales_client_name: null },
        "OK"
      )
    ).toBe("D: P — OK");
  });

  it("clientNamesSummary", () => {
    expect(
      clientNamesSummary([
        { sales_client_name: "A" },
        { sales_client_name: "A" },
      ])
    ).toBe("A");
    expect(
      clientNamesSummary([
        { sales_client_name: "A" },
        { sales_client_name: "B" },
      ])
    ).toBe("2 różnych klientów");
  });

  it("clientNamesSummaryFromLines", () => {
    expect(
      clientNamesSummaryFromLines([
        { clientName: "A" },
        { clientName: "B" },
      ])
    ).toBe("2 różnych klientów");
    expect(clientNamesSummaryFromLines([{ clientName: "Klinika" }])).toBe("Klinika");
  });

  it("formatInformacjaEmailLine", () => {
    expect(
      formatInformacjaEmailLine({
        supplier: { name: "D" },
        products: "P",
        symbol: "-",
        sales_client_name: "Jan",
      })
    ).toContain("Dla klienta: Jan");
  });
});
