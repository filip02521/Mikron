/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { HelpHintBubble } from "./HelpHintBubble";
import { ModalShell } from "./ModalShell";

const HINT = "Prośby klienta do pozycji z tego ZK";

describe("dymek pomocy w oknie", () => {
  afterEach(() => cleanup());

  it("otwarcie okna nie skupia ikonki ? w treści i nie pokazuje dymka", async () => {
    render(
      <ModalShell open onClose={() => undefined} title="Podgląd ZK">
        <h3>
          Powiązane prośby <HelpHintBubble message={HINT} />
        </h3>
        <button type="button">Podgląd</button>
      </ModalShell>
    );
    await act(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));
    expect(document.activeElement?.textContent).toBe("Podgląd");
    expect(screen.queryByText(HINT)).toBeNull();
  });
});
