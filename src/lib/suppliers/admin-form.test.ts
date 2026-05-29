import { describe, expect, it } from "vitest";
import { supplierToAdminForm } from "./admin-form";
import type { SupplierWithSchedule } from "@/types/database";

describe("supplierToAdminForm", () => {
  it("mapuje is_active z rekordu dostawcy", () => {
    const s = {
      id: "1",
      name: "Test",
      location: "POLSKA",
      is_active: false,
    } as SupplierWithSchedule;
    expect(supplierToAdminForm(s).is_active).toBe(false);
  });
});
