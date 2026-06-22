import { describe, expect, it, vi } from "vitest";
import { runServerActionWithRedirect } from "./server-action-redirect";

vi.mock("next/dist/client/components/redirect-error", () => ({
  isRedirectError: (error: unknown) =>
    error instanceof Error && error.message === "NEXT_REDIRECT",
}));

describe("runServerActionWithRedirect", () => {
  it("przekazuje redirect dalej do Next.js", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    const onError = vi.fn();

    await expect(
      runServerActionWithRedirect(() => Promise.reject(redirect), onError)
    ).rejects.toBe(redirect);
    expect(onError).not.toHaveBeenCalled();
  });

  it("obsługuje zwykły błąd przez callback", async () => {
    const onError = vi.fn();
    const result = await runServerActionWithRedirect(
      () => Promise.reject(new Error("fail")),
      onError
    );

    expect(result).toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "fail" }));
  });

  it("zwraca wynik akcji bez błędu", async () => {
    const result = await runServerActionWithRedirect(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
  });
});
