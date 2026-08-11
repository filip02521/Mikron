import { expect, test } from "@playwright/test";

test.describe("ZD estimate — prośby (E2E lab kontrakty)", () => {
  test("pure-logic: extras, excluded→usługi, uwagi, cover qty", async ({
    page,
  }) => {
    await page.goto("/e2e-lab");
    await expect(page.getByTestId("e2e-lab")).toBeVisible();
    await expect(page.getByTestId("zd-individuals-ok")).toHaveText("pass");
    const raw = await page.getByTestId("zd-individuals-checks").innerText();
    const checks = JSON.parse(raw) as Record<string, boolean>;
    expect(checks).toMatchObject({
      partnerMissingExtraZdUnits: true,
      excludedOrderCount: true,
      excludedRoutedToServices: true,
      prioritizeServicesKeepsOx: true,
      coverExtrasBumpsTo2: true,
    });
  });
});
