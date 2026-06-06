import { expect, test } from "@playwright/test";

test.describe("InformacjaFlowPicker (E2E lab)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/e2e-lab");
    await expect(page.getByTestId("e2e-lab")).toBeVisible();
  });

  test("domyślnie zaznacza direct i pozwala wybrać stock_out", async ({ page }) => {
    await expect(page.getByRole("radio", { name: /Informacja o dostępności/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await expect(page.getByTestId("selected-path")).toHaveText("direct");

    await page.getByRole("radio", { name: /Brak na stanie/i }).click();
    await expect(page.getByTestId("selected-path")).toHaveText("stock_out");
  });

  test("panel dzienny — trzecia ścieżka via_panel", async ({ page }) => {
    const viaPanel = page.getByRole("radio", { name: /Najpierw zamówienie u dostawcy/i });
    await expect(viaPanel).toBeVisible();

    await viaPanel.click();
    await expect(page.getByTestId("selected-path")).toHaveText("via_panel");
  });
});
