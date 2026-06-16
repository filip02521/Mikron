/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { testSalesNote } from "@/test-utils/fixtures";
import { ArchivedNotesSection } from "./ArchivedNotesSection";

describe("ArchivedNotesSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("w trybie embedded nie duplikuje nagłówka sekcji", () => {
    render(
      <ArchivedNotesSection
        embedded
        notes={[
          testSalesNote({
            id: "arch-1",
            body: "Stara notatka",
            archived_at: "2026-01-02T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
          }),
        ]}
      />
    );

    expect(screen.queryByText("Zarchiwizowane")).toBeNull();
    expect(screen.getByText("Stara notatka")).toBeTruthy();
  });

  it("poza panelem pokazuje nagłówek Zarchiwizowane", () => {
    render(
      <ArchivedNotesSection
        notes={[
          testSalesNote({
            id: "arch-2",
            body: "Inna notatka",
            archived_at: "2026-01-02T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
          }),
        ]}
      />
    );

    expect(screen.getByText("Zarchiwizowane")).toBeTruthy();
  });
});
