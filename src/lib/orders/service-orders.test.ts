import { describe, expect, it } from "vitest";
import {
  canMoveServiceOrder,
  flowIndex,
  isServiceOrderLate,
  needsRw,
  nextServiceOrderNumber,
  normalizeRwNumber,
  primaryNextStatus,
  rwClipboardText,
  rwLines,
  serviceOrderGroup,
  type ServiceOrderPart,
} from "./service-orders";

const part = (partTwId: number, quantity: number, partSymbol: string | null = `S${partTwId}`): ServiceOrderPart => ({
  id: `${partTwId}-${quantity}`,
  partTwId,
  partSymbol,
  partName: `Część ${partTwId}`,
  quantity,
  takenAt: "2026-11-04T10:00:00.000Z",
  takenByName: null,
});

describe("przejścia statusów", () => {
  it("droga naprawy naprzód", () => {
    expect(canMoveServiceOrder("przyjete", "diagnoza")).toBe(true);
    expect(canMoveServiceOrder("diagnoza", "w_naprawie")).toBe(true);
    expect(canMoveServiceOrder("w_naprawie", "gotowe")).toBe(true);
    expect(canMoveServiceOrder("gotowe", "wydane")).toBe(true);
  });
  it("czeka na część wraca tylko do naprawy (albo anulowanie)", () => {
    expect(canMoveServiceOrder("czeka_na_czesc", "w_naprawie")).toBe(true);
    expect(canMoveServiceOrder("czeka_na_czesc", "gotowe")).toBe(false);
  });
  it("wydane i anulowane są końcowe; nie da się wydać sprzętu, który nie jest gotowy", () => {
    expect(canMoveServiceOrder("wydane", "w_naprawie")).toBe(false);
    expect(canMoveServiceOrder("anulowane", "przyjete")).toBe(false);
    expect(canMoveServiceOrder("w_naprawie", "wydane")).toBe(false);
  });
  it("przycisk główny prowadzi drogą naprawy", () => {
    expect(primaryNextStatus("przyjete")).toBe("diagnoza");
    expect(primaryNextStatus("czeka_na_czesc")).toBe("w_naprawie");
    expect(primaryNextStatus("wydane")).toBeNull();
  });
  it("czeka na część stoi na osi tam, gdzie naprawa", () => {
    expect(flowIndex("czeka_na_czesc")).toBe(flowIndex("w_naprawie"));
    expect(flowIndex("anulowane")).toBe(-1);
  });
});

describe("numer zlecenia", () => {
  const nov = new Date(2026, 10, 4);
  it("pierwszy w miesiącu", () => {
    expect(nextServiceOrderNumber([], nov)).toBe("ZS/26/11/001");
  });
  it("kolejny po najwyższym z tego miesiąca, inne miesiące nie liczą się", () => {
    expect(nextServiceOrderNumber(["ZS/26/11/001", "ZS/26/11/007", "ZS/26/10/120"], nov)).toBe("ZS/26/11/008");
  });
  it("licznik ponad 999 nie gubi cyfr", () => {
    expect(nextServiceOrderNumber(["ZS/26/11/999"], nov)).toBe("ZS/26/11/1000");
  });
});

describe("RW", () => {
  it("do RW, gdy są części i brak numeru RW", () => {
    expect(needsRw({ rwNumber: null }, [part(1, 2)])).toBe(true);
    expect(needsRw({ rwNumber: "RW 1/2026" }, [part(1, 2)])).toBe(false);
    expect(needsRw({ rwNumber: null }, [])).toBe(false);
  });
  it("pozycje RW sumują tę samą część pobraną kilka razy", () => {
    const lines = rwLines([part(2, 1, "B"), part(1, 2, "A"), part(2, 3, "B")]);
    expect(lines.map((l) => [l.partSymbol, l.quantity])).toEqual([
      ["A", 2],
      ["B", 4],
    ]);
    expect(rwClipboardText(lines)).toBe("A\t2\nB\t4");
  });
  it("numer RW: wymaga cyfry, odrzuca znaki spoza numeracji", () => {
    expect(normalizeRwNumber("  RW   15/MAG/2026 ")).toBe("RW 15/MAG/2026");
    expect(normalizeRwNumber("RW")).toBeNull();
    expect(normalizeRwNumber("RW 1; DROP")).toBeNull();
    expect(normalizeRwNumber("")).toBeNull();
  });
});

describe("grupy listy", () => {
  it("zamknięte zlecenie z częściami bez RW trafia do „Do RW”", () => {
    expect(serviceOrderGroup({ status: "wydane", rwNumber: null }, [part(1, 1)])).toBe("do_rw");
    expect(serviceOrderGroup({ status: "wydane", rwNumber: "RW 1/26" }, [part(1, 1)])).toBe("zamkniete");
    expect(serviceOrderGroup({ status: "anulowane", rwNumber: null }, [])).toBe("zamkniete");
  });
  it("otwarte według tego, co trzeba zrobić", () => {
    expect(serviceOrderGroup({ status: "czeka_na_czesc", rwNumber: null }, [])).toBe("czeka_na_czesc");
    expect(serviceOrderGroup({ status: "gotowe", rwNumber: null }, [])).toBe("gotowe");
    expect(serviceOrderGroup({ status: "diagnoza", rwNumber: null }, [])).toBe("w_serwisie");
  });
});

describe("termin dla klienta", () => {
  const today = new Date(2026, 10, 4, 15, 0);
  it("po terminie tylko, gdy sprzęt nie jest gotowy", () => {
    expect(isServiceOrderLate({ status: "w_naprawie", dueDate: "2026-11-03" }, today)).toBe(true);
    expect(isServiceOrderLate({ status: "w_naprawie", dueDate: "2026-11-04" }, today)).toBe(false);
    expect(isServiceOrderLate({ status: "gotowe", dueDate: "2026-11-01" }, today)).toBe(false);
    expect(isServiceOrderLate({ status: "w_naprawie", dueDate: null }, today)).toBe(false);
  });
});

describe("kiedy wpisać RW", () => {
  it("od gotowego do wydania; w trakcie naprawy nie (kolejna część nie miałaby gdzie trafić)", async () => {
    const { canSetServiceOrderRw } = await import("./service-orders");
    expect(canSetServiceOrderRw("w_naprawie")).toBe(false);
    expect(canSetServiceOrderRw("czeka_na_czesc")).toBe(false);
    expect(canSetServiceOrderRw("gotowe")).toBe(true);
    expect(canSetServiceOrderRw("wydane")).toBe(true);
    expect(canSetServiceOrderRw("anulowane")).toBe(true);
  });
});

describe("etykiety przejść", () => {
  it("krok wstecz to „Wróć do”, naprzód — co się dzieje", async () => {
    const { transitionLabel } = await import("./service-orders");
    expect(transitionLabel("diagnoza", "w_naprawie")).toBe("Wróć do: diagnoza");
    expect(transitionLabel("w_naprawie", "gotowe")).toBe("Wróć do: w naprawie");
    expect(transitionLabel("przyjete", "diagnoza")).toBe("Wróć do: przyjęte");
    expect(transitionLabel("diagnoza", "przyjete")).toBe("Zacznij diagnozę");
    expect(transitionLabel("w_naprawie", "czeka_na_czesc")).toBe("Naprawa w toku");
    expect(transitionLabel("czeka_na_czesc", "w_naprawie")).toBe("Czeka na część");
    expect(transitionLabel("anulowane", "gotowe")).toBe("Anuluj zlecenie");
  });
});
