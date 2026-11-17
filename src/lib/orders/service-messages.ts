/**
 * Wiadomości do klienta z karty zlecenia — OnTime nie pisze do helpdesku, więc serwisant kopiuje tekst
 * i wkleja go w zgłoszenie. Czyste funkcje, bez DB; słowa jak w odpowiedziach serwisu w helpdesku.
 */
import {
  formatQuoteAmount,
  SERVICE_INBOUND_LABEL,
  SERVICE_OUTBOUND_LABEL,
  type ServiceOrder,
} from "@/lib/orders/service-orders";

export type MessagePart = { partName: string; quantity: number };
/** Jeden egzemplarz w wiadomości; zgłoszenie bywa na kilka urządzeń, każde z własnym numerem seryjnym. */
export type MessageDevice = { deviceName: string; serialNo: string | null };

/** „3 x łożyska, 1 x wrzeciono” — części zsumowane po nazwie, w kolejności pobrania. */
export function partsListText(parts: readonly MessagePart[]): string {
  const byName = new Map<string, number>();
  for (const p of parts) byName.set(p.partName, (byName.get(p.partName) ?? 0) + p.quantity);
  return [...byName].map(([name, qty]) => `${qty} x ${name}`).join(", ");
}

/** Pole „Zakres naprawy” na start: co ustaliła diagnoza, pod tym pobrane części. */
export function defaultQuoteScope(workNote: string, parts: readonly MessagePart[]): string {
  const list = partsListText(parts);
  return [workNote.trim(), list ? `Do wymiany: ${list}` : ""].filter(Boolean).join("\n");
}

function deviceLabel(d: MessageDevice): string {
  return d.serialNo ? `${d.deviceName} (nr seryjny ${d.serialNo})` : d.deviceName;
}

/** Wycena po diagnozie: per egzemplarz co zepsute i jakie części, kwota brutto, pytanie o zgodę. */
export function composeQuoteMessage(input: { items: readonly (MessageDevice & { scope: string })[]; amount: number }): string {
  const blocks = input.items.map((i) => [`${deviceLabel(i)}:`, i.scope.trim() || "zakres naprawy w opisie zgłoszenia"].join("\n"));
  return [
    "Dzień dobry,",
    "po diagnozie sprzętu ustaliliśmy:",
    blocks.join("\n\n"),
    `Całkowity koszt naprawy wynosi ${formatQuoteAmount(input.amount)} brutto. Prosimy o informację, czy możemy przystąpić do realizacji zlecenia.`,
    "Pozdrawiamy",
  ].join("\n\n");
}

export type ReleaseMessageInput = {
  items: readonly (MessageDevice & { parts: readonly MessagePart[] })[];
  /** Klient odmówił naprawy po wycenie — sprzęt wraca bez naprawy. */
  rejected: boolean;
  fsNumber: string | null;
  noInvoiceReason: string | null;
  /** Kwota z wyceny (zł brutto), gdy była. */
  amount: number | null;
  method: ServiceOrder["outbound"]["method"];
  tracking: string | null;
};

/** Sprzęt wraca do klienta: co wymieniono, faktura, koszt, jak i jakim numerem przesyłki. */
export function composeReleaseMessage(input: ReleaseMessageInput): string {
  const devices = input.items.map(deviceLabel).join(", ");
  const head = input.rejected
    ? `Zgodnie z Państwa decyzją sprzęt wraca bez naprawy: ${devices}.`
    : `Naprawa zakończona: ${devices}.`;
  const tracking = input.tracking?.trim();
  const how =
    input.method === "gls"
      ? `Sprzęt odsyłamy kurierem GLS${tracking ? `, numer przesyłki: ${tracking}` : ""}.`
      : input.method === "inny_kurier"
        ? `Sprzęt odsyłamy kurierem${tracking ? `, numer przesyłki: ${tracking}` : ""}.`
        : input.method === "osobiscie"
          ? "Sprzęt jest gotowy do odbioru osobistego."
          : "Sprzęt jest gotowy do odbioru osobistego lub wysyłki.";
  const replaced = input.rejected ? "" : partsListText(input.items.flatMap((i) => i.parts));
  const invoice = input.fsNumber ? `Faktura: ${input.fsNumber}.` : input.noInvoiceReason ? `Bez faktury: ${input.noInvoiceReason}.` : "";
  const cost = !input.rejected && input.amount != null ? `Koszt naprawy wynosi ${formatQuoteAmount(input.amount)} brutto.` : "";
  const body = [head, how, replaced ? `W ramach serwisu wymieniono: ${replaced}.` : "", invoice, cost].filter(Boolean).join("\n");
  return ["Dzień dobry,", body, "Pozdrawiamy"].join("\n\n");
}

/** YYYY-MM-DD → dd.mm */
function dayMonth(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${d}.${m}`;
}

/** Fakty transportu i wyceny do nagłówka karty; null — nie ma czego pokazać. */
export function inboundFact(inbound: ServiceOrder["inbound"]): string | null {
  if (!inbound.method) return null;
  return `Przyszło: ${SERVICE_INBOUND_LABEL[inbound.method]}${inbound.pickupDate ? ` · ${dayMonth(inbound.pickupDate)}` : ""}`;
}

export function outboundFact(outbound: ServiceOrder["outbound"]): string | null {
  if (!outbound.method) return null;
  return `Wróciło: ${SERVICE_OUTBOUND_LABEL[outbound.method]}${outbound.tracking ? ` · ${outbound.tracking}` : ""}`;
}

export function quoteFact(quote: ServiceOrder["quote"]): string | null {
  if (quote.amount == null) return null;
  const decision = quote.decision === "accepted" ? "klient akceptuje" : quote.decision === "rejected" ? "klient odmówił" : "czeka na decyzję";
  return `Wycena: ${formatQuoteAmount(quote.amount)} · ${decision}`;
}
