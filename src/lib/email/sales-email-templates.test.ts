import { describe, expect, it } from "vitest";
import {
  renderDeliveryArrivedEmail,
  renderInformacjaArrivedEmail,
  renderProcurementCancelEmail,
} from "@/lib/email/sales-email-templates";

describe("sales email templates", () => {
  it("delivery template contains structured fields and escapes HTML", () => {
    const { html, subject } = renderDeliveryArrivedEmail({
      recipientName: "Jan Kowalski",
      items: [
        {
          kind: "delivery",
          supplierName: "Dostawca",
          products: '<b>Wkręt</b>',
          symbol: "ABC",
          clientName: "Firma & Co",
          orderedQty: 10,
          deliveredQty: 10,
          deliveryKind: "complete",
        },
      ],
    });
    expect(subject).toContain("OnTime");
    expect(html).toContain("Gotowe do odbioru");
    expect(html).toContain("&lt;b&gt;Wkręt&lt;/b&gt;");
    expect(html).toContain("Firma &amp; Co");
    expect(html).toContain("/moje");
  });

  it("informacja template explains request type", () => {
    const { html } = renderInformacjaArrivedEmail({
      recipientName: "Anna",
      items: [
        {
          kind: "informacja",
          supplierName: "X",
          products: "Produkt",
          symbol: null,
          clientName: null,
        },
      ],
    });
    expect(html).toContain("Informacja o dostępności");
    expect(html).toContain("Na magazynie");
    expect(html).toContain("widziałem/am powiadomienie");
  });

  it("delivery omits partial hint when all items complete", () => {
    const completeOnly = renderDeliveryArrivedEmail({
      recipientName: "Jan",
      items: [
        {
          kind: "delivery",
          supplierName: "D",
          products: "P",
          symbol: null,
          clientName: null,
          orderedQty: 2,
          deliveredQty: 2,
          deliveryKind: "complete",
        },
      ],
    });
    expect(completeOnly.html).not.toContain("częściowej dostawie resztę");

    const partial = renderDeliveryArrivedEmail({
      recipientName: "Jan",
      items: [
        {
          kind: "delivery",
          supplierName: "D",
          products: "P",
          symbol: null,
          clientName: null,
          orderedQty: 5,
          deliveredQty: 2,
          deliveryKind: "partial",
        },
      ],
    });
    expect(partial.html).toContain("częściowej dostawie");
  });

  it("multi-item shows position label", () => {
    const { html } = renderDeliveryArrivedEmail({
      recipientName: "Jan",
      items: [
        {
          kind: "delivery",
          supplierName: "A",
          products: "1",
          symbol: null,
          clientName: null,
          orderedQty: 1,
          deliveredQty: 1,
          deliveryKind: "complete",
        },
        {
          kind: "delivery",
          supplierName: "B",
          products: "2",
          symbol: null,
          clientName: null,
          orderedQty: 1,
          deliveredQty: 1,
          deliveryKind: "complete",
        },
      ],
    });
    expect(html).toContain("Pozycja 1 z 2");
    expect(html).toContain("Pozycja 2 z 2");
  });

  it("procurement cancel template includes note and subject", () => {
    const { html, subject } = renderProcurementCancelEmail({
      recipientName: "Jan Kowalski",
      items: [
        {
          kind: "procurement_cancel",
          supplierName: "Dostawca",
          products: "Wkręt",
          symbol: "ABC",
          clientName: "Firma",
          procurementCancelNote: "Brak na stanie",
        },
      ],
    });
    expect(subject).toContain("Prośba anulowana");
    expect(html).toContain("Brak na stanie");
    expect(html).toContain("Wiadomość od działu dostaw");
    expect(html).toContain("/moje");
  });

  it("procurement cancel noteUpdated variant", () => {
    const { html, subject } = renderProcurementCancelEmail({
      recipientName: "Anna",
      noteUpdated: true,
      items: [
        {
          kind: "procurement_cancel",
          supplierName: "X",
          products: "Produkt",
          symbol: null,
          clientName: null,
          procurementCancelNote: "Nowa treść",
        },
      ],
    });
    expect(subject).toContain("Zaktualizowano wiadomość");
    expect(html).toContain("zaktualizował wiadomość");
    expect(html).toContain("Nowa treść");
  });
});
