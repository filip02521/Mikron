import { describe, expect, it } from "vitest";
import {
  applyDepartmentBoardTabToSearchParams,
  departmentBoardTabWidok,
} from "@/hooks/use-department-board-tab-url";

describe("applyDepartmentBoardTabToSearchParams", () => {
  it("ustawia widok i usuwa watek przy zmianie zakładki", () => {
    const params = new URLSearchParams("widok=pytania&watek=q1&dla=sp1");
    const next = applyDepartmentBoardTabToSearchParams(params, "announcements");
    expect(next.get("widok")).toBe("ogloszenia");
    expect(next.has("watek")).toBe(false);
    expect(next.get("dla")).toBe("sp1");
  });

  it("mapuje zakładkę pytań na widok pytania", () => {
    expect(departmentBoardTabWidok("questions")).toBe("pytania");
    expect(departmentBoardTabWidok("announcements")).toBe("ogloszenia");
  });
});
