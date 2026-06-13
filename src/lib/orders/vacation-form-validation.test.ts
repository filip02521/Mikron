import { describe, it, expect } from "vitest";
import {
  validateVacationFormInput,
  validateVacationOverlap,
} from "./vacation-form-validation";

describe("validateVacationFormInput", () => {
  const base = {
    supplier_id: "s1",
    start_date: "2025-09-10",
    end_date: "2025-09-20",
    last_order_date: "2025-09-05",
    active: true,
  };

  it("rejects active vacation with end date in the past", () => {
    const result = validateVacationFormInput(
      {
        ...base,
        start_date: "2025-08-01",
        end_date: "2025-08-15",
        last_order_date: "2025-07-25",
      },
      "2025-09-01"
    );
    expect(result.error).toMatch(/koniec minął/);
  });

  it("allows inactive vacation with end date in the past", () => {
    const result = validateVacationFormInput(
      {
        ...base,
        start_date: "2025-08-01",
        end_date: "2025-08-15",
        last_order_date: "2025-07-25",
        active: false,
      },
      "2025-09-01"
    );
    expect(result.error).toBeNull();
  });
});

describe("validateVacationOverlap", () => {
  it("detects overlapping active vacations", () => {
    const error = validateVacationOverlap(
      {
        supplier_id: "s1",
        start_date: "2025-09-10",
        end_date: "2025-09-20",
        last_order_date: "2025-09-05",
        active: true,
      },
      [
        {
          id: "other",
          start_date: "2025-09-15",
          end_date: "2025-09-25",
          last_order_date: "2025-09-10",
        },
      ]
    );
    expect(error).toMatch(/już aktywny urlop/);
  });

  it("skips self when editing", () => {
    const error = validateVacationOverlap(
      {
        id: "v1",
        supplier_id: "s1",
        start_date: "2025-09-10",
        end_date: "2025-09-20",
        last_order_date: "2025-09-05",
        active: true,
      },
      [
        {
          id: "v1",
          start_date: "2025-09-10",
          end_date: "2025-09-20",
          last_order_date: "2025-09-05",
        },
      ]
    );
    expect(error).toBeNull();
  });
});
