/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BoardThreadMessage } from "./BoardThreadMessage";

describe("BoardThreadMessage", () => {
  afterEach(() => {
    cleanup();
  });

  it("pokazuje rolę pytania handlowca", () => {
    render(
      <BoardThreadMessage
        tone="question"
        authorLabel="Anna"
        body="Kiedy będzie towar?"
        createdAt="2026-01-01T10:00:00Z"
      />
    );
    expect(screen.getByText("Pytanie handlowca")).toBeTruthy();
    expect(screen.getByText("Kiedy będzie towar?")).toBeTruthy();
  });

  it("pokazuje rolę odpowiedzi zakupów", () => {
    render(
      <BoardThreadMessage
        tone="procurement"
        authorLabel="Dział zakupów"
        body="Jutro potwierdzimy."
        createdAt="2026-01-02T10:00:00Z"
        replyKind="Odpowiedź"
      />
    );
    expect(screen.getByText("Odpowiedź")).toBeTruthy();
  });
});
