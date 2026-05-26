import { describe, expect, it } from "vitest";
import { salesTeamPageCopy } from "./team-ui";

describe("salesTeamPageCopy", () => {
  it("admin może tworzyć grupy — jasny opis", () => {
    const copy = salesTeamPageCopy(
      {
        isAdmin: true,
        isManager: false,
        canCreateGroups: true,
        hasTeamScope: true,
        groupNamesLabel: "Sklep, Biuro",
      },
      "grupy"
    );
    expect(copy.description).toContain("Twórz grupy");
    expect(copy.description).toContain("Użytkownicy");
  });

  it("kierownik bez scope — komunikat o adminie", () => {
    const copy = salesTeamPageCopy(
      {
        isAdmin: false,
        isManager: true,
        canCreateGroups: false,
        hasTeamScope: false,
        groupNamesLabel: "",
      },
      "overview"
    );
    expect(copy.description).toContain("Administrator");
  });

  it("kierownik ze scope — bez obietnicy tworzenia grup", () => {
    const copy = salesTeamPageCopy(
      {
        isAdmin: false,
        isManager: true,
        canCreateGroups: false,
        hasTeamScope: true,
        groupNamesLabel: "Sklep",
      },
      "grupy"
    );
    expect(copy.title).toBe("Przypisane grupy");
    expect(copy.description).toContain("Nowe grupy zakłada administrator");
  });
});
