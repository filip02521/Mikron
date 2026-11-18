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

  // Trzy ogłoszenia (dane wymyślone): dwa przypięte i jedno zwykłe, wszystkie nieprzeczytane.
  const three = [
    { ...sampleAnnouncement, id: "p1", title: "Przypięte pierwsze", body: "Treść P1", pinned: true },
    { ...sampleAnnouncement, id: "p2", title: "Przypięte drugie", body: "Treść P2", pinned: true },
    { ...sampleAnnouncement, id: "z1", title: "Zwykłe", body: "Treść Z1", pinned: false },
  ];
  const titles = () =>
    [...document.querySelectorAll("li")].map((li) => li.querySelector("button")?.textContent ?? "");

  it("pokazuje wszystkie ogłoszenia, także każde przypięte (nie tylko pierwsze z paska)", () => {
    render(<MojeAnnouncementsSection announcements={three} readAnnouncementIds={[]} />);
    expect(screen.getByText("Przypięte pierwsze")).toBeTruthy();
    expect(screen.getByText("Przypięte drugie")).toBeTruthy();
    expect(screen.getByText("Zwykłe")).toBeTruthy();
  });

  it("po odczycie wiersz zostaje na swoim miejscu (kolejność z wejścia na stronę)", () => {
    const { rerender } = render(<MojeAnnouncementsSection announcements={three} readAnnouncementIds={[]} />);
    const order = () => titles().map((t) => t.replace("Nowe", "").replace(/Zakupy.*$/, "").trim());
    const before = order();
    // Serwer po odświeżeniu zwraca pierwsze jako przeczytane — kiedyś zjeżdżało na dół listy.
    rerender(<MojeAnnouncementsSection announcements={three} readAnnouncementIds={["p1"]} />);
    expect(order()).toEqual(before);
    expect(titles()[0]).toContain("Przypięte pierwsze");
    expect(titles()[0]).not.toContain("Nowe");
  });

  it("odczyt ostatniego nowego ogłoszenia nie zwija sekcji", () => {
    const { rerender } = render(<MojeAnnouncementsSection announcements={three} readAnnouncementIds={["p1", "p2"]} />);
    fireEvent.click(screen.getByText("Zwykłe"));
    expect(screen.getByText("Treść Z1")).toBeTruthy();
    // Serwer po odczycie: wszystko przeczytane — sekcja i otwarty wiersz zostają.
    rerender(<MojeAnnouncementsSection announcements={three} readAnnouncementIds={["p1", "p2", "z1"]} />);
    expect(screen.getByText("Treść Z1")).toBeTruthy();
    expect(screen.getByText("Przypięte drugie")).toBeTruthy();
  });

  it("nowy link „Czytaj” otwiera wskazane ogłoszenie, nawet gdy wcześniej otwarto inne", () => {
    const { rerender } = render(
      <MojeAnnouncementsSection announcements={three} readAnnouncementIds={[]} focusAnnouncementId={null} />
    );
    fireEvent.click(screen.getByText("Zwykłe"));
    expect(screen.getByText("Treść Z1")).toBeTruthy();
    rerender(<MojeAnnouncementsSection announcements={three} readAnnouncementIds={[]} focusAnnouncementId="p2" />);
    expect(screen.getByText("Treść P2")).toBeTruthy();
    expect(screen.queryByText("Treść Z1")).toBeNull();
  });
});
