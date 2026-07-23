/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MojeAnnouncementsSection } from "./MojeAnnouncementsSection";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const sampleAnnouncement = {
  id: "a1",
  kind: "announcement" as const,
  status: "open" as const,
  title: "Test ogłoszenia",
  body: "Długa treść ogłoszenia widoczna po rozwinięciu.",
  created_by: "u1",
  sales_person_id: null,
  product_symbol: null,
  product_name: null,
  subiekt_tw_id: null,
  mikran_code: null,
  color: "default" as const,
  pinned: false,
  published_at: new Date().toISOString(),
  expires_at: null,
  answered_at: null,
  archived_at: null,
  closed_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("MojeAnnouncementsSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("nie renderuje się bez ogłoszeń", () => {
    const { container } = render(
      <MojeAnnouncementsSection announcements={[]} readAnnouncementIds={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("domyślnie zwija sekcję gdy wszystko przeczytane", () => {
    render(
      <MojeAnnouncementsSection
        announcements={[sampleAnnouncement]}
        readAnnouncementIds={["a1"]}
      />
    );

    expect(screen.getByText(/Ogłoszenia od zakupów/)).toBeTruthy();
    expect(screen.queryByText("Długa treść ogłoszenia")).toBeNull();
  });

  it("rozwija nieprzeczytane ogłoszenie po kliknięciu wiersza", () => {
    render(
      <MojeAnnouncementsSection
        announcements={[sampleAnnouncement]}
        readAnnouncementIds={[]}
      />
    );

    expect(screen.getByText("Test ogłoszenia")).toBeTruthy();
    fireEvent.click(screen.getByText("Test ogłoszenia"));
    expect(screen.getByText("Długa treść ogłoszenia widoczna po rozwinięciu.")).toBeTruthy();
  });
});
