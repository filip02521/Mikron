import { expect, test } from "@playwright/test";
import { CHANGELOG_LATEST_VERSION } from "@/lib/changelog/changelog-entries";

test.describe("ZD estimate — sesja zewnętrzna (E2E lab)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((seenVersion) => {
      window.sessionStorage.clear();
      // ChangelogAutoOpen inaczej otwiera modal i przechwytuje pointer events.
      window.localStorage.setItem("changelog-seen-version", seenVersion);
    }, CHANGELOG_LATEST_VERSION);
    await page.goto("/e2e-lab");
    await expect(page.getByTestId("e2e-lab")).toBeVisible();
    await expect(page.getByTestId("zd-external-session-lab")).toBeVisible();
  });

  test("Policz → wyjście → pływające powiadomienie → powrót → zamknij / anulowanie", async ({
    page,
  }) => {
    await page.getByTestId("zd-external-session-seed").click();
    await expect(page.getByTestId("zd-external-session-phase")).toHaveText(
      "active"
    );
    await expect(
      page.getByTestId("zd-external-session-floating-notice-host")
    ).toHaveCount(0);

    await page.getByTestId("zd-external-session-leave").click();
    await expect(page.getByTestId("zd-external-session-phase")).toHaveText(
      "away"
    );
    const notice = page.getByTestId("zd-external-session-floating-notice-host");
    await expect(notice).toBeVisible();
    await notice.hover();
    await expect(
      page.getByRole("link", { name: "Wróć do kreatora" })
    ).toBeVisible();

    await page.getByTestId("zd-external-session-return").click();
    await expect(page.getByTestId("zd-external-session-phase")).toHaveText(
      "returned"
    );
    await expect(
      page.getByTestId("zd-external-session-floating-notice-host")
    ).toHaveCount(0);

    await page.getByTestId("zd-external-session-seed").click();
    await page.getByTestId("zd-external-session-leave").click();
    await page.getByTestId("zd-external-session-floating-notice-host").hover();
    await expect(
      page.getByRole("button", { name: "Zamknij sesję" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Zamknij sesję" }).click();
    await expect(
      page.getByTestId("zd-external-session-floating-notice-host")
    ).toHaveCount(0);

    await page.getByTestId("zd-external-session-seed").click();
    await page.getByTestId("zd-external-session-leave").click();
    await page.getByTestId("zd-external-session-return").click();
    await page.getByTestId("zd-external-session-cancel").click();
    await expect(page.getByTestId("zd-external-session-phase")).toHaveText(
      "cancelled"
    );
    await expect(
      page.getByTestId("zd-external-session-floating-notice-host")
    ).toHaveCount(0);
  });
});
