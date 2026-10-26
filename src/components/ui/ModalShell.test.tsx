/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ModalShell } from "@/components/ui/ModalShell";

afterEach(cleanup);

describe("ModalShell — okno nad oknem", () => {
  it("Escape zamyka tylko najwyższe okno", () => {
    const closeBottom = vi.fn();
    const closeTop = vi.fn();
    render(
      <>
        <ModalShell open onClose={closeBottom} title="Pod spodem">
          <p>dolne</p>
        </ModalShell>
        <ModalShell open onClose={closeTop} title="Na wierzchu" tier="raised">
          <p>górne</p>
        </ModalShell>
      </>
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(closeTop).toHaveBeenCalledTimes(1);
    expect(closeBottom).not.toHaveBeenCalled();
  });

  it("po zamknięciu górnego Escape trafia do dolnego", () => {
    const closeBottom = vi.fn();
    const { rerender } = render(
      <>
        <ModalShell open onClose={closeBottom} title="Pod spodem">
          <p>dolne</p>
        </ModalShell>
        <ModalShell open onClose={() => {}} title="Na wierzchu" tier="raised">
          <p>górne</p>
        </ModalShell>
      </>
    );
    rerender(
      <>
        <ModalShell open onClose={closeBottom} title="Pod spodem">
          <p>dolne</p>
        </ModalShell>
        <ModalShell open={false} onClose={() => {}} title="Na wierzchu" tier="raised">
          <p>górne</p>
        </ModalShell>
      </>
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(closeBottom).toHaveBeenCalledTimes(1);
  });

  it("Escape obsłużony wcześniej (lista podpowiedzi) nie zamyka okna", () => {
    const close = vi.fn();
    render(
      <ModalShell open onClose={close} title="Okno">
        <p>treść</p>
      </ModalShell>
    );
    const e = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    e.preventDefault();
    window.dispatchEvent(e);
    expect(close).not.toHaveBeenCalled();
  });
});
