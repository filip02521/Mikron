/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfirmHost, askConfirm } from "./ConfirmHost";

describe("askConfirm", () => {
  afterEach(() => {
    cleanup();
  });

  it("resolves true on confirm and false on cancel", async () => {
    render(<ConfirmHost />);

    let result!: Promise<boolean>;
    act(() => {
      result = askConfirm({ title: "Usunąć wpis?", message: "Na stałe.", confirmLabel: "Usuń", danger: true });
    });
    fireEvent.click(await screen.findByRole("button", { name: "Usuń" }));
    await expect(result).resolves.toBe(true);

    act(() => {
      result = askConfirm({ title: "Usunąć wpis?", message: "Na stałe.", confirmLabel: "Usuń" });
    });
    fireEvent.click(await screen.findByRole("button", { name: "Anuluj" }));
    await expect(result).resolves.toBe(false);
  });

  it("focuses the confirm button only when defaultConfirm is set", async () => {
    render(<ConfirmHost />);

    act(() => {
      void askConfirm({ title: "Oznaczyć?", message: "Skrót klawiszowy.", confirmLabel: "Oznacz", defaultConfirm: true });
    });
    const confirm = await screen.findByRole("button", { name: "Oznacz" });
    await waitFor(() => expect(document.activeElement).toBe(confirm));
  });
});
