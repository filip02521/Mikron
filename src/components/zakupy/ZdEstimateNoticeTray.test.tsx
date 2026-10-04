/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ZdEstimateNotice } from "./ZdEstimateNotice";
import { ZdEstimateNoticeTrayBar, ZdEstimateNoticeTrayProvider } from "./ZdEstimateNoticeTray";

function Workbench({ showRecount = true }: { showRecount?: boolean }) {
  return (
    <ZdEstimateNoticeTrayProvider>
      <ZdEstimateNoticeTrayBar />
      <main>
        <ZdEstimateNotice tray tone="warning" title="Przelicz listę - zmienione podbicie">
          <button type="button">Przelicz</button>
        </ZdEstimateNotice>
        {showRecount ? (
          <ZdEstimateNotice tray tone="error" title="Ustawienia działu niedostępne">
            Wczytaj ponownie.
          </ZdEstimateNotice>
        ) : null}
        <ZdEstimateNotice tone="error" title="Nie udało się utworzyć ZD">
          Subiekt odrzucił dokument.
        </ZdEstimateNotice>
        <table aria-label="Lista do ZD" />
      </main>
    </ZdEstimateNoticeTrayProvider>
  );
}

describe("ZdEstimateNoticeTray", () => {
  afterEach(() => cleanup());

  it("komunikaty z `tray` schodzą do jednej linii, błąd ostatniej akcji zostaje nad tabelą", () => {
    render(<Workbench />);
    const bar = screen.getByRole("button", { name: /Uwagi \(2\)/ });
    // Najpierw najpoważniejsze (błąd), potem ostrzeżenia.
    expect(bar.textContent).toContain("Ustawienia działu niedostępne · Przelicz listę - zmienione podbicie");
    const panel = screen.getByRole("region", { name: "Uwagi kreatora ZD", hidden: true });
    expect(panel.className).toContain("hidden");
    // Komunikat bez `tray` jest w treści strony, nie w panelu.
    expect(within(screen.getByRole("main")).getByText("Nie udało się utworzyć ZD")).toBeTruthy();
  });

  it("panel otwiera pełne treści z akcjami i zamyka się Escape", () => {
    render(<Workbench />);
    fireEvent.click(screen.getByRole("button", { name: /Uwagi \(2\)/ }));
    const panel = screen.getByRole("region", { name: "Uwagi kreatora ZD" });
    expect(panel.className).not.toContain("hidden");
    // W panelu komunikat jest rozwinięty — przycisk akcji od razu dostępny.
    expect(within(panel).getByRole("button", { name: "Przelicz" })).toBeTruthy();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(panel.className).toContain("hidden");
  });

  it("licznik maleje, gdy komunikat znika albo zostanie zamknięty", () => {
    const { rerender } = render(<Workbench />);
    rerender(<Workbench showRecount={false} />);
    expect(screen.getByRole("button", { name: /Uwagi \(1\)/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Uwagi \(1\)/ }));
    fireEvent.click(screen.getByRole("button", { name: /Zamknij komunikat: Przelicz listę/ }));
    expect(screen.queryByRole("button", { name: /Uwagi \(/ })).toBeNull();
  });

  it("bez paska (inne ekrany) `tray` niczego nie chowa", () => {
    render(
      <ZdEstimateNotice tray tone="warning" title="Limit 500 próśb">
        Szczegóły
      </ZdEstimateNotice>
    );
    expect(screen.getByText("Limit 500 próśb")).toBeTruthy();
  });
});
