import { describe, expect, it } from "vitest";
import {
  supplierCardsHref,
  supplierHubContextForRole,
  supplierHubPaths,
  supplierHubShellDescription,
  supplierVacationsHref,
} from "./supplier-hub";

describe("supplier hub paths", () => {
  it("wybiera kontekst admin dla roli admin", () => {
    expect(supplierHubContextForRole("admin")).toBe("admin");
    expect(supplierHubContextForRole("zakupy")).toBe("zakupy");
    expect(supplierHubContextForRole(null)).toBe("zakupy");
  });

  it("buduje ścieżki admin i zakupy", () => {
    expect(supplierHubPaths("admin").cards).toBe("/admin/dostawcy");
    expect(supplierHubPaths("zakupy").vacations).toBe("/zakupy/urlopy");
    expect(supplierVacationsHref("admin")).toBe("/admin/urlopy");
  });

  it("buduje link do kart z parametrami", () => {
    expect(
      supplierCardsHref("admin", { q: "Acme", powiaz: true, subiekt: "unlinked" })
    ).toBe("/admin/dostawcy?q=Acme&powiaz=1&subiekt=unlinked");
  });

  it("zwraca krótki opis nagłówka per kontekst", () => {
    expect(supplierHubShellDescription("cards", "admin")).toMatch(/usuwanie/i);
    expect(supplierHubShellDescription("cards", "zakupy")).not.toMatch(/usuwanie/i);
  });
});
