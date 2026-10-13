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

  it("w drodze i wolne: liczba, pasek, ZD z terminem i akcja powiadomienia", () => {
    const onNotify = vi.fn();
    render(<ProsbaAlreadyOrderedHint info={free} requestedQty={2} onSwitchToNotify={onNotify} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Towar jest w drodze - wolne 10 szt.");
    expect(status.textContent).toContain("ZD 123/10 · 50 szt. · z 06.10 · termin 21.10");
    expect(screen.getByRole("img", { name: "W drodze: 20% wolne" })).toBeTruthy();
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
  it("jedna karta: werdykt, liczby (stan · w drodze · wolne), ZD z terminem, akcja", () => {
    render(
      <ProsbaAvailabilityCard line={line()} requestKind="zamowienie" info={freeFuture} onSwitchToNotify={() => {}} />
    );
    const card = screen.getByRole("region", { name: "Dostępność towaru" });
    expect(card.textContent).toContain("Towar jest w drodze - wolne 26 szt.");
    expect(card.textContent).toContain("Na stanie0 szt.");
    expect(card.textContent).toContain("W drodze35 szt.ZK 9");
    expect(card.textContent).toContain("Wolne26 szt.");
    expect(card.textContent).toContain("ZD 5/10/2026 · 35 szt. · z 06.10 · termin 21.10");
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
    expect(card.textContent).toContain("Wystarczający stan magazynowy");
    expect(card.textContent).toContain("może wystarczy wydać z magazynu");
    expect(screen.queryByRole("button", { name: /powiadom/ })).toBeNull();
  });

  it("w trakcie sprawdzania dostawy — stan od razu, w drodze „…”", () => {
    render(<ProsbaAvailabilityCard line={line()} requestKind="zamowienie" info={undefined} checking />);
    const card = screen.getByRole("region", { name: "Dostępność towaru" });
    expect(card.textContent).toContain("Brak dostępnego stanu");
    expect(card.textContent).toContain("W drodze…");
  });

  it("kilka pozycji: zamiast przełącznika — wskazówka i usunięcie pozycji", () => {
    const onRemove = vi.fn();
    render(
      <ProsbaAvailabilityCard line={line()} requestKind="zamowienie" info={freeFuture} onRemoveLine={onRemove} />
    );
    expect(screen.getByRole("region", { name: "Dostępność towaru" }).textContent).toContain(
      "usuń tę i dodaj ją osobno"
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
});
