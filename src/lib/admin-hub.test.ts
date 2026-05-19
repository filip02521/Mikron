import { describe, expect, it } from "vitest";
import { activeAdminHubTab } from "./admin-hub";

describe("admin hub", () => {
  it("rozpoznaje aktywną zakładkę po ścieżce", () => {
    expect(activeAdminHubTab("/admin")).toBe("system");
    expect(activeAdminHubTab("/admin/uzytkownicy")).toBe("users");
    expect(activeAdminHubTab("/admin/handlowcy")).toBe("sales");
  });
});
