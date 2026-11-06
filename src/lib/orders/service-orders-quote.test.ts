import { describe, expect, it } from "vitest";
import {
  allowedNextStatuses,
  canMoveServiceOrder,
  flowIndex,
  formatQuoteAmount,
  isBackwardTransition,
  parseQuoteAmount,
  primaryNextStatus,
  transitionLabel,
} from "@/lib/orders/service-orders";

describe("czeka na decyzję klienta", () => {
  it("wchodzi się z diagnozy, wychodzi do naprawy (akceptacja), do wydania (odmowa), do diagnozy albo anulowania", () => {
    expect(canMoveServiceOrder("diagnoza", "czeka_na_akceptacje")).toBe(true);
    expect(canMoveServiceOrder("w_naprawie", "czeka_na_akceptacje")).toBe(false);
    expect([...allowedNextStatuses("czeka_na_akceptacje")].sort()).toEqual(["anulowane", "diagnoza", "gotowe", "w_naprawie"]);
    expect(primaryNextStatus("czeka_na_akceptacje")).toBe("w_naprawie");
  });

  it("etykiety mówią o decyzji klienta; wejście nie jest krokiem wstecz", () => {
    expect(transitionLabel("w_naprawie", "czeka_na_akceptacje")).toBe("Klient akceptuje — naprawiaj");
    expect(transitionLabel("gotowe", "czeka_na_akceptacje")).toBe("Klient odmawia — zwrot bez naprawy");
    expect(transitionLabel("czeka_na_akceptacje", "diagnoza")).toBe("Wyślij wycenę klientowi");
    expect(isBackwardTransition("czeka_na_akceptacje", "w_naprawie")).toBe(false);
    expect(flowIndex("czeka_na_akceptacje")).toBe(flowIndex("diagnoza"));
  });
});

describe("kwota wyceny", () => {
  it("przyjmuje polski zapis, odrzuca tekst i ujemne", () => {
    expect(parseQuoteAmount("674,27")).toBe(674.27);
    expect(parseQuoteAmount("1 250 zł")).toBe(1250);
    expect(parseQuoteAmount("510.15 PLN")).toBe(510.15);
    expect(parseQuoteAmount("-5")).toBeNull();
    expect(parseQuoteAmount("dużo")).toBeNull();
    expect(parseQuoteAmount("")).toBeNull();
    expect(formatQuoteAmount(674.27).replace(/\s/g, " ")).toBe("674,27 zł");
  });
});

describe("powrót z wyceny do diagnozy", () => {
  it("jest cofnięciem z etykietą „Wróć do: diagnoza”", () => {
    expect(isBackwardTransition("diagnoza", "czeka_na_akceptacje")).toBe(true);
    expect(transitionLabel("diagnoza", "czeka_na_akceptacje")).toBe("Wróć do: diagnoza");
  });
});
