/**
 * Test wysyłki maili magazynu — TYLKO na adres z EMAIL_OVERRIDE_TO (domyślnie filip.naskret@mikran.com).
 * Nie modyfikuje zamówień w bazie.
 *
 * Uruchom:
 *   EMAIL_OVERRIDE_TO=filip.naskret@mikran.com npx tsx --env-file=.env.local scripts/test-warehouse-emails.ts
 */
import {
  sendDeliveryNotificationEmails,
  sendInformacjaArrivedEmails,
} from "../src/lib/services/email";
import type { SalesPersonEmailBatch } from "../src/lib/email/sales-notification-types";
import { getEmailFromAddress, isEmailConfigured } from "../src/lib/env/email-config";

const TARGET = process.env.EMAIL_OVERRIDE_TO?.trim() ?? "filip.naskret@mikran.com";

async function main() {
  if (!isEmailConfigured()) {
    console.error("Brak RESEND_API_KEY w .env.local");
    process.exit(1);
  }

  process.env.EMAIL_OVERRIDE_TO = TARGET;
  console.log(`Nadawca: ${getEmailFromAddress()}`);
  console.log(`Wysyłka testowa (override → ${TARGET})\n`);

  const deliveryBatch: SalesPersonEmailBatch = {
    email: "handlowiec.przyklad@mikran.com",
    name: "Handlowiec (test)",
    items: [
      {
        kind: "delivery",
        supplierName: "Dostawca testowy",
        products: "Wkręt tytanowy 4.2",
        symbol: "ABC-123",
        clientName: "Klient demo",
        orderedQty: 5,
        deliveredQty: 5,
        deliveryKind: "complete",
      },
      {
        kind: "delivery",
        supplierName: "Dostawca testowy",
        products: "Podkładka",
        symbol: "XYZ",
        clientName: null,
        orderedQty: 10,
        deliveredQty: 3,
        deliveryKind: "partial",
      },
    ],
  };

  const informacjaBatch: SalesPersonEmailBatch = {
    email: "handlowiec.przyklad@mikran.com",
    name: "Handlowiec (test)",
    items: [
      {
        kind: "informacja",
        supplierName: "Mestra",
        products: "Microwave — piec",
        symbol: "PIEC-1",
        clientName: null,
      },
    ],
  };

  const deliveryMap = new Map([["test-person", deliveryBatch]]);
  const infoMap = new Map([["test-person", informacjaBatch]]);

  console.log("1/2 Mail dostawy (actionUpdateDelivered / batch)…");
  const d = await sendDeliveryNotificationEmails(deliveryMap);
  console.log(`   wysłano: ${d.sent}, błędy: ${d.failures.length}`);
  if (d.failures[0]) console.log(`   ${d.failures[0].to}: ${d.failures[0].error}`);

  console.log("2/2 Mail informacji (actionMarkInformacjaArrived)…");
  const i = await sendInformacjaArrivedEmails(infoMap);
  console.log(`   wysłano: ${i.sent}, błędy: ${i.failures.length}`);
  if (i.failures[0]) console.log(`   ${i.failures[0].to}: ${i.failures[0].error}`);

  if (d.sent + i.sent === 2) {
    console.log(`\n✓ Sprawdź skrzynkę ${TARGET} (tematy z prefiksem [TEST → …]).`);
  } else {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
