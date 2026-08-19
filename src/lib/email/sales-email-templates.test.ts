import { describe, expect, it } from "vitest";
import {
  renderDeliveryArrivedEmail,
  renderInformacjaArrivedEmail,
  renderProcurementCancelEmail,
  renderRequestNoteUpdateEmail,
  renderBoardQuestionReplyEmail,
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
    expect(html).toContain("Na regale");
    expect(html).toContain("widziałem/am powiadomienie");
    expect(html).toContain("magazyn potwierdza dostępność");
  });

  it("informacja stock_auto — copy o Subiekcie, nie magazyn potwierdził", () => {
    const { html, subject } = renderInformacjaArrivedEmail({
      recipientName: "Anna",
      items: [
        {
          kind: "informacja",
          supplierName: "X",
          products: "Produkt",
          symbol: null,
          clientName: null,
          arrivedSource: "stock_auto",
        },
      ],
    });
    expect(subject).toContain("na stanie");
    expect(html).toContain("Na stanie");
    expect(html).toContain("stanu magazynowego w Subiekcie");
    expect(html).not.toContain("magazyn potwierdza dostępność");
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

  it("request note update email", () => {
    const { html, subject } = renderRequestNoteUpdateEmail({
      recipientName: "Anna",
      items: [
        {
          kind: "request_note_update",
          supplierName: "Mikran",
          products: "Zestaw A",
          symbol: "SYM-1",
          clientName: "Klient",
          requestNote: "Termin na piątek",
        },
      ],
    });
    expect(subject).toContain("Zaktualizowano uwagi");
    expect(html).toContain("zaktualizował uwagi");
    expect(html).toContain("Termin na piątek");
    expect(html).toContain("Widziałem");
    expect(html).toContain("/moje");
  });

  it("board question reply email zawiera odpowiedź, deep-link i wyróżnia Tablicę", () => {
    const { html, subject } = renderBoardQuestionReplyEmail({
      recipientName: "Jan Kowalski",
      threadId: "q-42",
      questionTitle: "Termin <dostawy>?",
      questionBody: "Kiedy będzie & produkt?",
      productSymbol: "ABC",
      productName: "Produkt X",
      replyBody: "W czwartek.\nPotwierdzone.",
    });
    expect(subject).toContain("Tablica");
    expect(subject).toContain("odpowiedź");
    expect(subject).not.toContain("Moje zamówienia");
    expect(html).toContain("Wiadomość z Tablicy");
    expect(html).toContain("Odpowiedź na Twoje pytanie");
    expect(html).not.toContain("zamówienia indywidualnego");
    expect(html).toContain("Tablica · wiadomość");
    expect(html).toContain("Odpowiedź działu zakupów");
    expect(html).toContain("W czwartek.<br />Potwierdzone.");
    expect(html).toContain("Termin &lt;dostawy&gt;?");
    expect(html).toContain("Kiedy będzie &amp; produkt?");
    expect(html).toContain("ABC");
    expect(html).toContain("/tablica?watek=q-42");
    expect(html).not.toContain("#question-");
    expect(html).toContain("Otwórz pytanie na Tablicy");
    expect(html).not.toContain("/moje");
    expect(html).not.toContain("Moje zamówienia");
  });
});
