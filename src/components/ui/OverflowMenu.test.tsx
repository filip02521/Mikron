/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OverflowMenu, OverflowMenuItem } from "./OverflowMenu";

describe("OverflowMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("standalone iconOnly opens on click", () => {
    const onAction = vi.fn();
    render(
      <OverflowMenu label="Test menu" iconOnly>
        <OverflowMenuItem onClick={onAction}>Action</OverflowMenuItem>
      </OverflowMenu>
    );

    fireEvent.click(screen.getByRole("button", { name: "Test menu" }));
    expect(screen.getByRole("menuitem", { name: "Action" })).toBeTruthy();
  });

  it("segment variant opens on click", () => {
    const onAction = vi.fn();
    render(
      <OverflowMenu label="Test menu" iconOnly variant="segment">
        <OverflowMenuItem onClick={onAction}>Action</OverflowMenuItem>
      </OverflowMenu>
    );

    fireEvent.click(screen.getByRole("button", { name: "Test menu" }));
    expect(screen.getByRole("menuitem", { name: "Action" })).toBeTruthy();
  });

  it("keyboard: focus starts on the first item, arrows wrap, choosing returns focus to the trigger", async () => {
    const onSecond = vi.fn();
    render(
      <OverflowMenu label="Test menu" iconOnly>
        <OverflowMenuItem onClick={() => {}}>First</OverflowMenuItem>
        <OverflowMenuItem onClick={() => {}} disabled>
          Disabled
        </OverflowMenuItem>
        <OverflowMenuItem onClick={onSecond}>Second</OverflowMenuItem>
      </OverflowMenu>
    );
    const trigger = screen.getByRole("button", { name: "Test menu" });
    fireEvent.click(trigger);
    const menu = await screen.findByRole("menu");
    await vi.waitFor(() => expect(document.activeElement?.textContent).toBe("First"));

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toBe("Second"); // pomija wyłączoną
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toBe("First"); // zawija
    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement?.textContent).toBe("Second");

    fireEvent.click(document.activeElement as HTMLElement);
    expect(onSecond).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
