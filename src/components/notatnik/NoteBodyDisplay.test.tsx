/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NoteBodyDisplay } from "./NoteBodyDisplay";

describe("NoteBodyDisplay", () => {
  afterEach(() => {
    cleanup();
  });

  it("renderuje akapit z pogrubieniem", () => {
    render(<NoteBodyDisplay body="To jest **ważne**." />);
    expect(screen.getByText("ważne").tagName).toBe("STRONG");
  });

  it("renderuje listę punktowaną", () => {
    render(<NoteBodyDisplay body={"- pierwszy\n- drugi"} />);
    const list = screen.getByRole("list");
    expect(list.tagName).toBe("UL");
    expect(screen.getByText("pierwszy")).toBeTruthy();
    expect(screen.getByText("drugi")).toBeTruthy();
  });

  it("pokazuje placeholder przy pustej treści", () => {
    render(<NoteBodyDisplay body="   " />);
    expect(screen.getByText("Brak treści")).toBeTruthy();
  });
});
