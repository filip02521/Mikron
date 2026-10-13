/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const copyMock = vi.fn<(text: string) => Promise<boolean>>();
vi.mock("@/lib/ui/copy-text-to-clipboard", () => ({
  copyTextToClipboard: (text: string) => copyMock(text),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/moje",
  useSearchParams: () => new URLSearchParams(),
}));

import { ZkProsbaLinkChip } from "@/components/orders/ZkProsbaLinkChip";

afterEach(() => {
  cleanup();
  copyMock.mockReset();
});

describe("ZkProsbaLinkChip - kopiowanie numeru", () => {
  it("bez `copyable` nie ma przycisku", () => {
    render(<ZkProsbaLinkChip zkNumber="ZK 1453/M/08/2026" inline />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("kopiuje pełny numer, potwierdza i nie przepuszcza kliknięcia do karty", async () => {
    copyMock.mockResolvedValue(true);
    const onCardClick = vi.fn();
    render(
      <div onClick={onCardClick}>
        <ZkProsbaLinkChip zkNumber="ZK 1453/M/08/2026" inline copyable />
      </div>
    );
    const button = screen.getByRole("button", { name: "Kopiuj numer ZK 1453/M/08/2026" });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(copyMock).toHaveBeenCalledWith("ZK 1453/M/08/2026");
    expect(onCardClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Skopiowano ZK 1453/M/08/2026" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Skopiowano");
  });

  it("gdy schowek odmówi — komunikat błędu zamiast udawanego sukcesu", async () => {
    copyMock.mockResolvedValue(false);
    render(<ZkProsbaLinkChip zkNumber="ZK 1453/M/08/2026" inline copyable />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(screen.getByRole("status").textContent).toBe("Nie udało się skopiować");
  });
});
