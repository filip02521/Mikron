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
});
