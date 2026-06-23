import { describe, expect, it } from "vitest";
import {
  parseDepartmentBoardQuestionFilter,
  DEPARTMENT_BOARD_QUESTION_FILTER_PARAM,
} from "@/hooks/use-department-board-sales-question-url";

describe("use-department-board-sales-question-url", () => {
  it("parsuje filtr z URL", () => {
    expect(parseDepartmentBoardQuestionFilter("unseen")).toBe("unseen");
    expect(parseDepartmentBoardQuestionFilter("mine")).toBe("mine");
    expect(parseDepartmentBoardQuestionFilter("invalid")).toBeNull();
    expect(parseDepartmentBoardQuestionFilter(null)).toBeNull();
  });

  it("eksportuje nazwę parametru filtra", () => {
    expect(DEPARTMENT_BOARD_QUESTION_FILTER_PARAM).toBe("filtr");
  });
});
