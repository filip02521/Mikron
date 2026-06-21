import { expect, test } from "@playwright/test";

test.describe("Podgląd panelu zakupów (E2E lab)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/e2e-lab");
    await expect(page.getByTestId("e2e-lab")).toBeVisible();
  });

  test("blokuje mutacje w podglądzie handlowca", async ({ page }) => {
    await expect(page.getByTestId("preview-sales-read-only")).toHaveText("readOnly: yes");
    await page.getByTestId("preview-sales-mutate").click();
    await expect(page.getByTestId("preview-sales-result")).toHaveText("blocked");
  });

  test("zezwalają na mutacje w podglądzie zakupów", async ({ page }) => {
    await expect(page.getByTestId("preview-zakupy-read-only")).toHaveText("readOnly: no");
    await page.getByTestId("preview-zakupy-mutate").click();
    await expect(page.getByTestId("preview-zakupy-result")).toHaveText("allowed");
  });
});

test.describe("Hub dostawców — podpowiedzi zakładek (E2E lab)", () => {
  test("strona logowania ładuje katalog kont w trybie E2E", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("option").first()).toBeVisible();
    await expect(page.getByRole("listbox", { name: "Wybierz konto" })).toBeVisible();
  });
});
