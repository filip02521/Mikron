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

  it("maps workspaces to departments", () => {
    expect(departmentsForRole("zakupy", ["dostawy"])).toEqual(["zakupy"]);
    expect(departmentsForRole("zakupy", ["zeby"])).toEqual(["zakupy"]);
    expect(departmentsForRole("zakupy", ["magazyn"])).toEqual(["magazyn"]);
    expect(departmentsForRole("zakupy", ["dostawy", "magazyn"])).toEqual(["zakupy", "magazyn"]);
    expect(departmentsForRole("zakupy", [])).toEqual(["zakupy"]);
  });

  it("parses dzial query for allowed roles", () => {
    expect(parseOperationsDepartment("magazyn", "admin")).toBe("magazyn");
    expect(parseOperationsDepartment("magazyn", "zakupy")).toBe(null);
    expect(defaultDepartmentForRole("magazyn")).toBe("magazyn");
  });

  it("parses dzial query with workspaces", () => {
    expect(parseOperationsDepartment("magazyn", "zakupy", ["magazyn"])).toBe("magazyn");
    expect(parseOperationsDepartment("magazyn", "zakupy", ["dostawy"])).toBe(null);
    expect(parseOperationsDepartment("zakupy", "zakupy", ["magazyn"])).toBe(null);
    expect(defaultDepartmentForRole("zakupy", ["magazyn"])).toBe("magazyn");
    expect(defaultDepartmentForRole("zakupy", ["dostawy"])).toBe("zakupy");
  });

  it("gates notepad access", () => {
    expect(canAccessOperationsNotepad("zakupy")).toBe(true);
    expect(canAccessOperationsNotepad("magazyn")).toBe(true);
    expect(canAccessOperationsNotepad("sales")).toBe(false);
  });

  it("gates notepad access with workspaces", () => {
    expect(canAccessOperationsNotepad("zakupy", ["dostawy"])).toBe(true);
    expect(canAccessOperationsNotepad("zakupy", ["magazyn"])).toBe(true);
    expect(canAccessOperationsNotepad("zakupy", [])).toBe(true);
    expect(canAccessOperationsNotepad("sales", ["dostawy"])).toBe(true);
    expect(canAccessOperationsNotepad("sales", [])).toBe(false);
  });
});
