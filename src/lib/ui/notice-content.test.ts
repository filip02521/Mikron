import { describe, expect, it } from "vitest";
import {
  noticeToastProps,
  resolveFormMessage,
  resolveNoticeCopy,
  splitNoticeText,
} from "@/lib/ui/notice-content";

describe("notice-content", () => {
  it("splitNoticeText — myślnik", () => {
    expect(splitNoticeText("Zapisano dostawę — 3 pozycje trafiły do magazynu.")).toEqual({
      title: "Zapisano dostawę",
      description: "3 pozycje trafiły do magazynu.",
    });
  });

  it("splitNoticeText — zdanie", () => {
    expect(splitNoticeText("Operacja zakończona. Sprawdź listę pozycji.")).toEqual({
      title: "Operacja zakończona.",
      description: "Sprawdź listę pozycji.",
    });
  });

  it("splitNoticeText — krótki tekst bez podziału", () => {
    expect(splitNoticeText("Zapisano.")).toEqual({ title: "Zapisano." });
  });

  it("resolveNoticeCopy — jawny tytuł", () => {
    expect(
      resolveNoticeCopy({
        title: "Błąd zapisu",
        text: "Spróbuj ponownie za chwilę.",
      }),
    ).toEqual({
      title: "Błąd zapisu",
      description: "Spróbuj ponownie za chwilę.",
    });
  });

  it("resolveFormMessage", () => {
    expect(
      resolveFormMessage({
        tone: "error",
        title: "Brak ilości",
        text: "Uzupełnij liczbę sztuk przy każdej pozycji.",
      }),
    ).toEqual({
      title: "Brak ilości",
      description: "Uzupełnij liczbę sztuk przy każdej pozycji.",
    });
  });

  it("noticeToastProps — string", () => {
    expect(noticeToastProps("Zapisano zmiany.", "success")).toEqual({
      title: "Zapisano zmiany.",
      description: undefined,
      tone: "success",
      durationMs: undefined,
    });
  });

  it("noticeToastProps — obiekt z tytułem", () => {
    expect(
      noticeToastProps({
        title: "Dodano pozycje zębowe",
        text: "Dodano przody: Ivoclar A2 · 6 szt.",
        tone: "success",
        durationMs: 8000,
      }),
    ).toEqual({
      title: "Dodano pozycje zębowe",
      description: "Dodano przody: Ivoclar A2 · 6 szt.",
      tone: "success",
      durationMs: 8000,
    });
  });
});
