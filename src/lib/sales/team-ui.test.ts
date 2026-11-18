import { describe, expect, it } from "vitest";
import { salesTeamPageCopy } from "./team-ui";

describe("salesTeamPageCopy", () => {
  it("admin może tworzyć grupy - jasny opis", () => {
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

  // Prośbę o przypisanie grup mówi baner w layoucie /zespol — opis strony jej nie powtarza (każdy fakt raz).
  it("kierownik bez scope - opis strony bez powtórzenia banera o adminie", () => {
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
    expect(copy.description).not.toContain("administratora");
    expect(copy.description).toContain("Twoich grup");
  });

  it("kierownik ze scope - bez obietnicy tworzenia grup", () => {
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
    expect(copy.title).toBe("Grupy");
    expect(copy.description).toContain("Nowe grupy zakłada administrator");
  });
});
