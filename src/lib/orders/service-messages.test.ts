import { describe, expect, it } from "vitest";
import {
  composeQuoteMessage,
  composeReleaseMessage,
  defaultQuoteScope,
  inboundFact,
  outboundFact,
  partsListText,
  quoteFact,
  type ReleaseMessageInput,
} from "./service-messages";

const bearings = { partName: "łożyska", quantity: 2 };

describe("partsListText / defaultQuoteScope", () => {
  it("sums parts by name", () => {
    expect(partsListText([bearings, { partName: "wrzeciono", quantity: 1 }, { partName: "łożyska", quantity: 1 }])).toBe("3 x łożyska, 1 x wrzeciono");
    expect(partsListText([])).toBe("");
  });
  it("prefills scope from diagnosis note and parts", () => {
    expect(defaultQuoteScope(" Zatarte łożyska ", [bearings])).toBe("Zatarte łożyska\nDo wymiany: 2 x łożyska");
    expect(defaultQuoteScope("", [])).toBe("");
    expect(defaultQuoteScope("", [bearings])).toBe("Do wymiany: 2 x łożyska");
  });
});

describe("composeQuoteMessage", () => {
  it("lists each serial with its scope, the gross total and the standard question", () => {
    const msg = composeQuoteMessage({
      items: [
        { deviceName: "Prostownica A", serialNo: "SN1", scope: "3 x łożyska" },
        { deviceName: "Prostownica B", serialNo: null, scope: "" },
      ],
      amount: 674.27,
    });
    expect(msg).toContain("Prostownica A (nr seryjny SN1):\n3 x łożyska");
    expect(msg).toContain("Prostownica B:\nzakres naprawy w opisie zgłoszenia");
    expect(msg).toContain("Całkowity koszt naprawy wynosi 674,27 zł brutto. Prosimy o informację, czy możemy przystąpić do realizacji zlecenia.");
  });
});

describe("composeReleaseMessage", () => {
  const base: ReleaseMessageInput = {
    items: [{ deviceName: "Prostownica A", serialNo: "SN1", parts: [{ partName: "łożyska", quantity: 4 }, { partName: "przewód", quantity: 1 }] }],
    rejected: false,
    fsNumber: "FV 434/M/11/2026",
    noInvoiceReason: null,
    amount: 510.15,
    method: "gls",
    tracking: "123456",
  };

  it("accepted repair with invoice, cost and GLS parcel", () => {
    const msg = composeReleaseMessage(base);
    expect(msg).toContain("Naprawa zakończona: Prostownica A (nr seryjny SN1).");
    expect(msg).toContain("Sprzęt odsyłamy kurierem GLS, numer przesyłki: 123456.");
    expect(msg).toContain("W ramach serwisu wymieniono: 4 x łożyska, 1 x przewód.");
    expect(msg).toContain("Faktura: FV 434/M/11/2026.");
    expect(msg).toContain("Koszt naprawy wynosi 510,15 zł brutto.");
  });

  it("without invoice gives the reason; without quote no cost; personal pickup", () => {
    const msg = composeReleaseMessage({ ...base, fsNumber: null, noInvoiceReason: "gwarancja", amount: null, method: "osobiscie", tracking: null });
    expect(msg).toContain("Bez faktury: gwarancja.");
    expect(msg).not.toContain("Koszt naprawy");
    expect(msg).toContain("gotowy do odbioru osobistego.");
  });

  it("no invoice data at all, other courier without number, no method yet", () => {
    expect(composeReleaseMessage({ ...base, fsNumber: null, method: "inny_kurier", tracking: " " })).toContain("Sprzęt odsyłamy kurierem.");
    const msg = composeReleaseMessage({ ...base, fsNumber: null, method: null });
    expect(msg).not.toContain("Faktura");
    expect(msg).toContain("gotowy do odbioru osobistego lub wysyłki.");
  });

  it("rejected quote: returns without repair, no parts and no cost", () => {
    const msg = composeReleaseMessage({ ...base, rejected: true, fsNumber: null });
    expect(msg).toContain("Zgodnie z Państwa decyzją sprzęt wraca bez naprawy: Prostownica A (nr seryjny SN1).");
    expect(msg).not.toContain("wymieniono");
    expect(msg).not.toContain("Koszt naprawy");
  });

  it("several serials list every device and all parts", () => {
    const msg = composeReleaseMessage({
      ...base,
      items: [...base.items, { deviceName: "Prostownica B", serialNo: "SN2", parts: [{ partName: "łożyska", quantity: 2 }] }],
    });
    expect(msg).toContain("Naprawa zakończona: Prostownica A (nr seryjny SN1), Prostownica B (nr seryjny SN2).");
    expect(msg).toContain("wymieniono: 6 x łożyska, 1 x przewód.");
  });
});

describe("header facts", () => {
  it("inbound, outbound, quote", () => {
    expect(inboundFact({ method: "odbior_mikran", pickupDate: "2026-11-10" })).toBe("Przyszło: Odbiór kurierem Mikranu · 10.11");
    expect(inboundFact({ method: "osobiscie", pickupDate: null })).toBe("Przyszło: Klient przynosi osobiście");
    expect(inboundFact({ method: null, pickupDate: null })).toBeNull();
    expect(outboundFact({ method: "gls", tracking: "1234", address: null })).toBe("Wróciło: Kurier GLS · 1234");
    expect(outboundFact({ method: null, tracking: null, address: null })).toBeNull();
    const q = { amount: 674.27, note: "", sentAt: "2026-11-01T10:00:00Z", decidedAt: null };
    expect(quoteFact({ ...q, decision: "accepted" })).toBe("Wycena: 674,27 zł · klient akceptuje");
    expect(quoteFact({ ...q, decision: "rejected" })).toBe("Wycena: 674,27 zł · klient odmówił");
    expect(quoteFact({ ...q, decision: null })).toBe("Wycena: 674,27 zł · czeka na decyzję");
    expect(quoteFact({ ...q, amount: null, decision: null })).toBeNull();
  });
});
