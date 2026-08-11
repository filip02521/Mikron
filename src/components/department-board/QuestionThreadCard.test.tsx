/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DepartmentBoardQuestion } from "@/lib/data/department-board-shared";
import { QuestionThreadCard } from "./QuestionThreadCard";

vi.mock("@/app/actions/department-board", () => ({
  actionMarkQuestionThreadSeen: vi.fn().mockResolvedValue({ ok: true }),
  actionReplyToQuestion: vi.fn(),
  actionArchiveQuestion: vi.fn(),
  actionCloseQuestion: vi.fn(),
  actionReopenQuestion: vi.fn(),
  actionDeleteClosedQuestion: vi.fn(),
}));

import { actionMarkQuestionThreadSeen } from "@/app/actions/department-board";

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [0.45, 0.6];
  readonly scrollMargin = "";

  constructor(private callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, intersectionRatio: 1, target } as IntersectionObserverEntry],
      this
    );
  }

  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

function testQuestion(): DepartmentBoardQuestion {
  return {
    id: "q1",
    kind: "question",
    status: "answered",
    created_by: "u1",
    sales_person_id: "sp1",
    color: "default",
    pinned: false,
    published_at: "",
    title: "Termin dostawy",
    body: "Kiedy będzie towar?",
    product_symbol: "606402",
    product_name: "Implant testowy",
    subiekt_tw_id: 123,
    mikran_code: null,
    expires_at: null,
    answered_at: "2026-01-02T10:00:00Z",
    archived_at: null,
    closed_by: null,
    created_at: "2026-01-01T10:00:00Z",
    updated_at: "2026-01-02T10:00:00Z",
    sales_person: { id: "sp1", name: "Anna" },
    author: { email: "anna@firma.pl", role: "sales" },
    posts: [
      {
        id: "p1",
        thread_id: "q1",
        body: "Jutro potwierdzimy.",
        created_by: "u2",
        created_at: "2026-01-02T10:00:00Z",
        author: { email: "zakupy@firma.pl", role: "zakupy" },
      },
    ],
  };
}

describe("QuestionThreadCard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("nie oznacza wątku jako przeczytany dopóki użytkownik go nie rozwinie", async () => {
    render(
      <QuestionThreadCard
        question={testQuestion()}
        embedded
        unseenReply
        autoMarkSeen
        defaultExpanded={false}
      />
    );

    await waitFor(() => {
      expect(actionMarkQuestionThreadSeen).not.toHaveBeenCalled();
    });
  });

  it("pokazuje chip produktu w wierszu tytułu", () => {
    render(<QuestionThreadCard question={testQuestion()} embedded defaultExpanded={false} />);
    expect(screen.getAllByText("606402 — Implant testowy").length).toBeGreaterThan(0);
  });

  it("pokazuje kontekst produktu po rozwinięciu", () => {
    render(<QuestionThreadCard question={testQuestion()} embedded defaultExpanded />);
    expect(screen.getByText("Produkt")).toBeTruthy();
    expect(screen.getAllByText("606402 — Implant testowy").length).toBeGreaterThan(0);
    expect(screen.getByText("Pytanie handlowca")).toBeTruthy();
    expect(screen.getByText("Odpowiedź")).toBeTruthy();
  });

  it("pokazuje nazwę karty handlowca przy doprecyzowaniu w wątku", () => {
    const question = testQuestion();
    question.posts = [
      {
        id: "p1",
        thread_id: "q1",
        body: "Jutro potwierdzimy.",
        created_by: "u2",
        created_at: "2026-01-02T10:00:00Z",
        author: { email: "zakupy@firma.pl", role: "zakupy" },
      },
      {
        id: "p2",
        thread_id: "q1",
        body: "Chodzi o wariant A.",
        created_by: "u1",
        created_at: "2026-01-02T11:00:00Z",
        author: {
          email: "anna.kowalski@firma.pl",
          role: "sales",
          sales_person: { id: "sp1", name: "Anna" },
        },
      },
    ];

    render(<QuestionThreadCard question={question} embedded defaultExpanded />);

    expect(screen.getByText("Doprecyzowanie handlowca")).toBeTruthy();
    expect(screen.getAllByText("Anna").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("anna.kowalski")).toBeNull();
  });

  it("przy doprecyzowaniu bierze kartę z pytania, gdy profil autora nie ma sales_person", () => {
    const question = testQuestion();
    question.posts = [
      {
        id: "p1",
        thread_id: "q1",
        body: "Jutro potwierdzimy.",
        created_by: "u2",
        created_at: "2026-01-02T10:00:00Z",
        author: { email: "zakupy@firma.pl", role: "zakupy" },
      },
      {
        id: "p2",
        thread_id: "q1",
        body: "Chodzi o wariant A.",
        created_by: "u1",
        created_at: "2026-01-02T11:00:00Z",
        author: {
          email: "anna.kowalski@firma.pl",
          role: "sales",
        },
      },
    ];

    render(<QuestionThreadCard question={question} embedded defaultExpanded />);

    expect(screen.getByText("Doprecyzowanie handlowca")).toBeTruthy();
    expect(screen.getAllByText("Anna").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("anna.kowalski")).toBeNull();
  });

  it("oznacza wątek po rozwinięciu i wejściu w widok", async () => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    render(
      <QuestionThreadCard
        question={testQuestion()}
        embedded
        unseenReply
        autoMarkSeen
        defaultExpanded={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Pytanie: Termin dostawy/i }));

    await waitFor(() => {
      expect(actionMarkQuestionThreadSeen).toHaveBeenCalledWith("q1");
    });

    vi.unstubAllGlobals();
  });

  it("dla administratora pokazuje Usuń na zakończonym wątku", () => {
    const question = testQuestion();
    question.archived_at = "2026-01-03T10:00:00Z";
    question.status = "archived";

    render(
      <QuestionThreadCard
        question={question}
        embedded
        defaultExpanded
        canDeleteClosed
        canReopen
      />
    );

    expect(screen.getByRole("button", { name: "Usuń" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Otwórz ponownie" })).toBeTruthy();
  });
});
