import { describe, expect, it } from "vitest";
import {
  canAccessOperationsNotepad,
  defaultDepartmentForRole,
  departmentsForRole,
  parseOperationsDepartment,
} from "./notepad-department";

describe("notepad-department", () => {
  it("maps roles to departments", () => {
    expect(departmentsForRole("admin")).toEqual(["zakupy", "magazyn"]);
    expect(departmentsForRole("zakupy")).toEqual(["zakupy"]);
    expect(departmentsForRole("magazyn")).toEqual(["magazyn"]);
    expect(departmentsForRole("sales")).toEqual([]);
  });

  it("parses dzial query for allowed roles", () => {
    expect(parseOperationsDepartment("magazyn", "admin")).toBe("magazyn");
    expect(parseOperationsDepartment("magazyn", "zakupy")).toBe(null);
    expect(defaultDepartmentForRole("magazyn")).toBe("magazyn");
  });

  it("gates notepad access", () => {
    expect(canAccessOperationsNotepad("zakupy")).toBe(true);
    expect(canAccessOperationsNotepad("magazyn")).toBe(true);
    expect(canAccessOperationsNotepad("sales")).toBe(false);
  });
});
