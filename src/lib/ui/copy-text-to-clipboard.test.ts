/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "./copy-text-to-clipboard";

describe("copyTextToClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("używa Clipboard API w secure context", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    await expect(copyTextToClipboard("a@b.pl")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("a@b.pl");
  });

  it("fallback do execCommand gdy Clipboard API rzuca", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });

    await expect(copyTextToClipboard("mail@example.com")).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("zwraca false dla pustego tekstu", async () => {
    await expect(copyTextToClipboard("")).resolves.toBe(false);
  });
});
