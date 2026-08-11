/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProsbaSupplierLeadTimeMeta } from "./ProsbaSupplierLeadTimeMeta";
import type { DeliveryStats } from "@/types/database";

const stats: DeliveryStats = {
  supplier_id: "s1",
  main_sum: 24,
  main_count: 3,
  main_avg: 8,
  side_sum: 0,
  side_count: 0,
  side_avg: 0,
};

describe("ProsbaSupplierLeadTimeMeta", () => {
  afterEach(() => cleanup());

  it("nie renderuje nic bez historii", () => {
    const { container } = render(
      <ProsbaSupplierLeadTimeMeta
        supplierIds={["s1"]}
        suppliers={[{ id: "s1", name: "Acme", stats_mode: "LACZNIE" }]}
        statsBySupplierId={{}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("pokazuje subtelną metę przy znanym dostawcy", () => {
    render(
      <ProsbaSupplierLeadTimeMeta
        supplierIds={["s1"]}
        suppliers={[{ id: "s1", name: "Acme", stats_mode: "LACZNIE" }]}
        statsBySupplierId={{ s1: stats }}
      />
    );
    expect(screen.getByLabelText("Średni czas dostawy")).toBeTruthy();
    expect(screen.getByText("Średni czas")).toBeTruthy();
    expect(screen.getByText("~8 dni rob.")).toBeTruthy();
    expect(screen.getByText("3 dostawy")).toBeTruthy();
  });

  it("przy showSupplierNames pokazuje nazwę zamiast etykiety", () => {
    render(
      <ProsbaSupplierLeadTimeMeta
        supplierIds={["s1"]}
        suppliers={[{ id: "s1", name: "Acme", stats_mode: "LACZNIE" }]}
        statsBySupplierId={{ s1: stats }}
        showSupplierNames
      />
    );
    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.queryByText("Średni czas")).toBeNull();
  });

  it("wariant underLink — subtelna linia pod powiązaniem produktu", () => {
    render(
      <ProsbaSupplierLeadTimeMeta
        variant="underLink"
        supplierIds={["s1"]}
        suppliers={[{ id: "s1", name: "Acme", stats_mode: "LACZNIE" }]}
        statsBySupplierId={{ s1: stats }}
      />
    );
    expect(screen.getByText("Orientacyjnie")).toBeTruthy();
    expect(screen.getByText("~8 dni rob.")).toBeTruthy();
    expect(screen.getByText("do magazynu")).toBeTruthy();
    expect(screen.getByText("3 dostawy")).toBeTruthy();
    expect(screen.queryByText("Średni czas")).toBeNull();
  });
});
