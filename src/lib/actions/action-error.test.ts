import { describe, expect, it } from "vitest";
import { redirect } from "next/navigation";
import {
  ActionError,
  isActionErrorResult,
  runActionSafely,
  unwrapActionResult,
} from "./action-error";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

class CodedError extends Error {
  readonly code = "PROSBA_SUFFICIENT_STOCK_ACK_REQUIRED";
}

describe("runActionSafely / unwrapActionResult", () => {
  it("przepuszcza wynik bez zmian", async () => {
    const r = await runActionSafely(async () => ({ success: true as const, n: 2 }));
    expect(r).toEqual({ success: true, n: 2 });
    await expect(unwrapActionResult(r)).resolves.toEqual({ success: true, n: 2 });
  });

  it("zamienia throw na wartość z treścią i kodem", async () => {
    const r = await runActionSafely(async () => {
      throw new CodedError("Towar jest na stanie - potwierdź");
    });
    expect(isActionErrorResult(r)).toBe(true);
    expect(r).toEqual({
      actionError: "Towar jest na stanie - potwierdź",
      actionErrorCode: "PROSBA_SUFFICIENT_STOCK_ACK_REQUIRED",
    });
  });

  it("unwrap rzuca ActionError z prawdziwą treścią (widoczną w UI)", async () => {
    const r = runActionSafely(async () => {
      throw new Error("Nie można dostarczyć więcej niż aktywne zamówienie (3 szt.)");
    });
    const err = await unwrapActionResult(r).catch((e) => e);
    expect(err).toBeInstanceOf(ActionError);
    expect(userFacingErrorText(err, "Nie udało się zapisać.")).toBe(
      "Nie można dostarczyć więcej niż aktywne zamówienie (3 szt.)"
    );
  });

  it("redirect() nadal leci jako throw (nawigacja Next)", async () => {
    await expect(
      runActionSafely(async () => {
        redirect("/login");
      })
    ).rejects.toThrow();
  });
});
