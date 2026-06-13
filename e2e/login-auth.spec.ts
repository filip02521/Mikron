import { expect, test } from "@playwright/test";

test.describe("Login auth API contracts", () => {
  test("login wysyła accountId bez e-maila w trybie pickera", async ({ page }) => {
    let loginBody: Record<string, unknown> | null = null;

    await page.route("**/api/auth/login", async (route) => {
      loginBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Nieprawidłowy e-mail lub hasło" }),
      });
    });

    await page.goto("/login");
    await page.getByRole("option").first().click();
    await page.getByLabel("Hasło").fill("test-haslo");
    await page.getByRole("button", { name: "Zaloguj się" }).click();

    await expect.poll(() => loginBody).not.toBeNull();
    expect(loginBody).toMatchObject({ accountId: expect.any(String), password: "test-haslo" });
    expect(loginBody).not.toHaveProperty("email");
  });

  test("reset hasła wysyła accountId", async ({ page }) => {
    let sendBody: Record<string, unknown> | null = null;

    await page.route("**/api/auth/password-reset/send", async (route) => {
      sendBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          maskedEmail: "j***@firma.pl",
          resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      });
    });

    await page.route("**/api/auth/password-reset/verify", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, redirectTo: "/ustaw-haslo?reset=otp" }),
      });
    });

    await page.goto("/login");
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Reset hasła" }).click();
    await expect(page.getByText("Wysłaliśmy 6-cyfrowy kod")).toBeVisible();

    expect(sendBody).toMatchObject({ accountId: expect.any(String) });
    expect(sendBody).not.toHaveProperty("email");
  });
});
