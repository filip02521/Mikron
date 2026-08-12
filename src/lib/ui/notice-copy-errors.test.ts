import { describe, expect, it } from "vitest";
import { toastFromError, toastFromUnknown } from "./notice-copy";

describe("toastFromError — user-facing", () => {
  it("uprawnienia → tytuł Brak uprawnień, bez stacka", () => {
    const toast = toastFromError(
      "Error: Brak uprawnień do operacji zakupowych\n    at requireOperations (auth.ts:1:1)"
    );
    expect(toast.tone).toBe("error");
    expect(toast.title).toBe("Brak uprawnień");
    expect(toast.text).toMatch(/zakupów/i);
    expect(toast.text).not.toMatch(/\bat\s/);
    expect(toast.text).not.toMatch(/^Error:/);
  });

  it("numery kurierów → konkretny opis", () => {
    const toast = toastFromError("Brak uprawnień do numerów kurierów");
    expect(toast.title).toBe("Brak uprawnień");
    expect(toast.text).toMatch(/kurierów/i);
  });

  it("pusty detail → fallback", () => {
    const toast = toastFromError(undefined, "Spróbuj ponownie.");
    expect(toast.title).toBe("Operacja nie powiodła się");
    expect(toast.text).toBe("Spróbuj ponownie.");
  });

  it("techniczny dump → fallback kontekstowy", () => {
    const toast = toastFromError(
      "Cannot read properties of undefined",
      "Nie udało się zapisać dziennika."
    );
    expect(toast.text).toBe("Nie udało się zapisać dziennika.");
  });

  it("zachowuje komunikat biznesowy", () => {
    const toast = toastFromError("Nie znaleziono ZK w Subiekcie.");
    expect(toast.text).toBe("Nie znaleziono ZK w Subiekcie.");
  });
});

describe("toastFromUnknown", () => {
  it("Error z uprawnień", () => {
    const toast = toastFromUnknown(
      new Error("Brak uprawnień magazynu")
    );
    expect(toast.title).toBe("Brak uprawnień");
    expect(toast.text).toMatch(/magazynu/i);
  });

  it("techniczny Error → fallback", () => {
    const toast = toastFromUnknown(
      new Error("fetch failed"),
      "Nie udało się wczytać listy."
    );
    // "fetch failed" → network OR technical; either way not raw
    expect(toast.text ?? "").not.toMatch(/fetch failed/i);
    expect((toast.text ?? "").length).toBeGreaterThan(10);
  });
});
