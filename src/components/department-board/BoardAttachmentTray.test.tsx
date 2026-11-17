/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";

vi.mock("@/lib/client/compress-image", () => ({
  COMPRESS_IMAGE_MAX_INPUT_BYTES: 20 * 1024 * 1024,
  compressImageFile: vi.fn(async (f: File) => new Blob([await f.arrayBuffer()], { type: "image/jpeg" })),
}));

import { useBoardQuestionImages } from "./useBoardQuestionImages";
import { BoardAttachmentTray, boardAttachmentsPhrase } from "./BoardAttachmentTray";

URL.createObjectURL = vi.fn(() => "blob:x");
URL.revokeObjectURL = vi.fn();
afterEach(() => cleanup());

const pdf = (name: string, size = 10) => new File([new Uint8Array(size)], name, { type: "application/pdf" });
const jpg = (name: string) => new File([new Uint8Array(10)], name, { type: "image/jpeg" });

describe("załączniki na Tablicy", () => {
  it("dodane pliki zostają, a każdy odrzucony ma własny powód", async () => {
    const { result } = renderHook(() => useBoardQuestionImages());
    await act(() =>
      result.current.addFiles([
        pdf("oferta.pdf"),
        new File([new Uint8Array(3)], "spakowane.zip", { type: "application/zip" }),
        pdf("pusty.pdf", 0),
        jpg("a.jpg"),
        jpg("b.jpg"),
        jpg("c.jpg"),
        jpg("d.jpg"),
      ])
    );
    expect(result.current.docs.map((d) => d.file.name)).toEqual(["oferta.pdf"]);
    expect(result.current.images).toHaveLength(3);
    expect(result.current.issues).toEqual([
      "„spakowane.zip”: tego typu nie można dołączyć - zdjęcia, PDF, Excel, Word albo CSV.",
      "„pusty.pdf” jest pusty.",
      "„d.jpg” pominięte - najwyżej 3 zdjęcia.",
    ]);
    act(() => result.current.dismissIssues());
    expect(result.current.issues).toEqual([]);
    expect(result.current.docs).toHaveLength(1);
  });

  it("limit 5 plików liczy też pliki dodane wcześniej", async () => {
    const { result } = renderHook(() => useBoardQuestionImages());
    await act(() => result.current.addFiles([1, 2, 3, 4].map((i) => pdf(`${i}.pdf`))));
    await act(() => result.current.addFiles([pdf("5.pdf"), pdf("6.pdf")]));
    expect(result.current.docs.map((d) => d.file.name)).toEqual(["1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf"]);
    expect(result.current.issues).toEqual(["„6.pdf” pominięty - najwyżej 5 plików."]);
  });

  it("taca: licznik, pełna nazwa i typ pliku, usuwanie; w trakcie wysyłki bez usuwania i ze stanem", () => {
    const onRemoveDoc = vi.fn();
    const docs = [{ key: "d1", file: pdf("Oferta Falcon listopad 2026 - pełna wersja.pdf", 1300 * 1024) }];
    const props = { images: [], docs, onRemoveImage: vi.fn(), onRemoveDoc, totalBytes: 1300 * 1024 };
    const { rerender } = render(<BoardAttachmentTray {...props} />);
    expect(screen.getByText("Zdjęcia 0/3 · Pliki 1/5 · razem 1,3 MB")).toBeTruthy();
    expect(screen.getByText("Oferta Falcon listopad 2026 - pełna wersja.pdf")).toBeTruthy();
    expect(screen.getByText("PDF")).toBeTruthy();
    expect(screen.getByText(/serwer OnTime może odrzucić/)).toBeTruthy();
    screen.getByRole("button", { name: /Usuń Oferta Falcon/ }).click();
    expect(onRemoveDoc).toHaveBeenCalledWith("d1");
    rerender(<BoardAttachmentTray {...props} sending />);
    expect(screen.queryByRole("button", { name: /Usuń/ })).toBeNull();
    expect(screen.getByText(/Wysyłam 1 plik \(1,3 MB\)…/)).toBeTruthy();
  });

  it("dwa dodania naraz (wklejenie w trakcie kompresji) nie przekraczają limitów i mówią, co pominęły", async () => {
    const { result } = renderHook(() => useBoardQuestionImages());
    await act(async () => {
      const first = result.current.addFiles([jpg("a.jpg"), jpg("b.jpg"), jpg("c.jpg")]);
      const second = result.current.addFiles([jpg("d.jpg"), pdf("1.pdf"), pdf("2.pdf"), pdf("3.pdf")]);
      const third = result.current.addFiles([pdf("4.pdf"), pdf("5.pdf"), pdf("6.pdf")]);
      await Promise.all([first, second, third]);
    });
    expect(result.current.images).toHaveLength(3);
    expect(result.current.docs.map((d) => d.file.name)).toEqual(["1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf"]);
    expect(result.current.issues).toEqual(["„d.jpg” pominięte - najwyżej 3 zdjęcia.", "„6.pdf” pominięty - najwyżej 5 plików."]);
  });

  it("plik ponad łączny limit 15 MB jest pominięty z powodem", async () => {
    const { result } = renderHook(() => useBoardQuestionImages());
    await act(() => result.current.addFiles([pdf("a.pdf", 9 * 1024 * 1024), pdf("b.pdf", 9 * 1024 * 1024)]));
    expect(result.current.docs.map((d) => d.file.name)).toEqual(["a.pdf"]);
    expect(result.current.issues[0]).toMatch(/razem nie mogą przekraczać 15 MB/);
  });

  it("podsumowanie liczby załączników z odmianą", () => {
    expect(boardAttachmentsPhrase(1, 2)).toBe("2 pliki i 1 zdjęcie");
    expect(boardAttachmentsPhrase(5, 0)).toBe("5 zdjęć");
    expect(boardAttachmentsPhrase(0, 5)).toBe("5 plików");
  });
});
