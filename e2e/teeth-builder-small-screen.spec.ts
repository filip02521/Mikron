import { expect, test } from "@playwright/test";

/** Laptop z niską wysokością okna — treść modala musi się przewijać, stopka z zapisem ma być osiągalna. */
test.use({ viewport: { width: 1366, height: 600 } });

test.describe("Lista zębów na niskim ekranie (E2E lab)", () => {
  test("długą listę da się przewinąć, a stopka z zapisem jest widoczna", async ({ page }) => {
    await page.goto("/e2e-lab");
    await page.getByRole("button", { name: "Otwórz listę zębów" }).click();

    const dialog = page.getByRole("dialog", { name: "Lista zębów" });
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(600);

    const footer = dialog.locator("footer");
    await expect(footer).toBeInViewport();

    const body = dialog.locator("[data-scroll-lock-allow]");
    const scrolls = await body.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(scrolls).toBe(true);
    await body.hover();
    await page.mouse.wheel(0, 2000);
    await expect
      .poll(() => body.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
  });
});
