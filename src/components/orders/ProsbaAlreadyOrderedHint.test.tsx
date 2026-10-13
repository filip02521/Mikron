/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  ProsbaAlreadyOrderedHint,
  ProsbaAvailabilityCard,
} from "@/components/orders/ProsbaAlreadyOrderedHint";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import type { ProsbaAlreadyOrderedInfo } from "@/lib/orders/prosba-already-ordered";

// Termin ZD „21.10” musi być w przyszłości niezależnie od dnia uruchomienia testów.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T10:00:00+02:00"));
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const free: ProsbaAlreadyOrderedInfo = {
  own: [],
  incoming: {
    incoming: 50,
    available: -3,
    zkWaiting: 37,
    freeIncoming: 10,
    docs: [{ dokNr: "123/10", issued: "2026-10-06", deadline: "2026-10-21", qty: 50 }],
  },
};

describe("ProsbaAlreadyOrderedHint", () => {
  it("nic nie renderuje bez danych", () => {
    const { container } = render(<ProsbaAlreadyOrderedHint info={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("w drodze i wolne: liczba, ZD z terminem i akcja powiadomienia", () => {
    const onNotify = vi.fn();
    render(<ProsbaAlreadyOrderedHint info={free} requestedQty={2} onSwitchToNotify={onNotify} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Towar jest w drodze - wolne 10 szt.");
    expect(status.textContent).toContain("ZD 123/10 · 50 szt. · z 06.10 · termin 21.10");
    expect(screen.queryByRole("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tylko powiadom, gdy dotrze" }));
    expect(onNotify).toHaveBeenCalledTimes(1);
  });

  it("wolne mniej niż potrzeba — bez propozycji powiadomienia", () => {
    render(<ProsbaAlreadyOrderedHint info={free} requestedQty={30} onSwitchToNotify={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("W drodze wolne tylko 10 szt.");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("własny dubel: usunięcie pozycji, tryb „w imieniu” bez „Twoja”", () => {
    const onRemove = vi.fn();
    render(
      <ProsbaAlreadyOrderedHint
        info={{
          own: [
            {
              id: "r",
              phase: "pending",
              createdAt: "2026-10-10T08:00:00Z",
              orderedAt: null,
              quantity: 2,
              deliveredQuantity: 0,
              supplierName: null,
            },
          ],
          incoming: null,
        }}
        onSwitchToNotify={() => {}}
        onRemoveLine={onRemove}
        forOther
      />
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Ten handlowiec ma już otwartą prośbę na ten towar");
    expect(status.textContent).not.toContain("Twoja");
    expect(screen.queryByRole("button", { name: /powiadom/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Usuń tę pozycję" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

function line(over: Partial<ProductLineDraft> = {}): ProductLineDraft {
  return {
    id: "l1",
    symbol: "F72",
    mikranCode: "4963",
    product: "Frez",
    quantity: "2",
    subiektTwId: 4963,
    onHand: 0,
    reserved: 0,
    available: 0,
    stockSource: "subiekt",
    source: "subiekt",
    ...over,
  };
}

const freeFuture: ProsbaAlreadyOrderedInfo = {
  own: [],
  incoming: {
    incoming: 35,
    available: 0,
    zkWaiting: 9,
    freeIncoming: 26,
    docs: [{ dokNr: "ZD 5/10/2026", issued: "2026-10-06", deadline: "2026-10-21", qty: 35 }],
  },
};

describe("ProsbaAvailabilityCard", () => {
  it("panele: werdykt, stan · w drodze · wolne, ZD, akcja", () => {
    render(
      <ProsbaAvailabilityCard line={line()} requestKind="zamowienie" info={freeFuture} onSwitchToNotify={() => {}} />
    );
    const card = screen.getByRole("region", { name: "Dostępność towaru" });
    expect(card.textContent).toContain("Towar jest w drodze - wolne 26 szt.");
    expect(card.textContent).toContain("Na stanie");
    expect(card.textContent).toContain("0 szt.");
    expect(card.textContent).toContain("W drodze");
    expect(card.textContent).toContain("35 szt.");
    expect(card.textContent).toContain("ZK 9");
    expect(card.textContent).toContain("Wolne z dostawy");
    expect(card.textContent).toContain("26 szt.");
    expect(card.textContent).toContain("ZD 5/10/2026 · 35 szt. · z 06.10 · termin 21.10");
    expect(card.querySelector("dl")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tylko powiadom, gdy dotrze" })).toBeTruthy();
  });

  it("wystarczy z półki wygrywa nad dostawą", () => {
    render(
      <ProsbaAvailabilityCard
        line={line({ onHand: 12, available: 12 })}
        requestKind="zamowienie"
        info={freeFuture}
        onSwitchToNotify={() => {}}
      />
    );
    const card = screen.getByRole("region", { name: "Dostępność towaru" });
    expect(card.textContent).toContain("Wystarczy z półki");
    expect(card.textContent).toContain("12 szt.");
    expect(card.textContent).not.toContain("Potrzebujesz");
    expect(screen.queryByRole("button", { name: /powiadom/ })).toBeNull();
  });

  it("w trakcie sprawdzania dostawy — stan od razu, w drodze „…”", () => {
    render(<ProsbaAvailabilityCard line={line()} requestKind="zamowienie" info={undefined} checking />);
    const card = screen.getByRole("region", { name: "Dostępność towaru" });
    expect(card.textContent).toContain("Brak na stanie");
    expect(card.textContent).toMatch(/W drodze…|…/);
  });

  it("bez dostawy — Wolne z dostawy to „—”, nie 0", () => {
    render(
      <ProsbaAvailabilityCard
        line={line({ onHand: 6, available: 6 })}
        requestKind="zamowienie"
        info={{
          own: [],
          incoming: {
            incoming: 0,
            available: 6,
            zkWaiting: 8,
            freeIncoming: 0,
            docs: [],
          },
        }}
      />
    );
    const card = screen.getByRole("region", { name: "Dostępność towaru" });
    expect(card.textContent).toMatch(/—\s*Wolne z dostawy/);
    expect(card.textContent).not.toMatch(/0 szt\.\s*Wolne z dostawy/);
  });

  it("kilka pozycji: zamiast przełącznika — wskazówka i usunięcie pozycji", () => {
    const onRemove = vi.fn();
    render(
      <ProsbaAvailabilityCard line={line()} requestKind="zamowienie" info={freeFuture} onRemoveLine={onRemove} />
    );
    expect(screen.getByRole("region", { name: "Dostępność towaru" }).textContent).toContain(
      "usuń tę i złóż osobno"
    );
    fireEvent.click(screen.getByRole("button", { name: "Usuń tę pozycję" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("informacja — brak karty", () => {
    const { container } = render(
      <ProsbaAvailabilityCard line={line()} requestKind="informacja" info={freeFuture} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("jedna sekcja: najpierw dostępność, meta dostawcy na końcu", () => {
    render(
      <ProsbaAvailabilityCard
        line={line()}
        requestKind="zamowienie"
        info={freeFuture}
        onSwitchToNotify={() => {}}
        supplierTiming={{
          supplierId: "sup-1",
          suppliers: [{ id: "sup-1", name: "Alpha Dental", stats_mode: "LACZNIE" }],
          supplierScheduleById: {
            "sup-1": {
              computedNextDate: "2099-03-15",
              orderOnDemand: false,
            },
          },
          todayDateKey: "2099-03-01",
          statsBySupplierId: {},
          showLeadTime: false,
        }}
      />
    );
    const card = screen.getByRole("region", { name: "Dostępność towaru" });
    expect(card.textContent).toContain("Towar jest w drodze");
    expect(card.textContent).toContain("Alpha Dental");
    expect(card.textContent).toMatch(/15\.03/);
    expect(screen.queryByLabelText("Dostawca pozycji")).toBeNull();
  });
});
