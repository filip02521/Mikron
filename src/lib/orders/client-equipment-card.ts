import type { ClientEquipmentItem, InvoiceRepairRef } from "@/lib/subiekt/client-equipment-parse";
import type { SerialHistoryItem } from "@/lib/orders/service-orders";
import { warrantyMonthsFor, warrantyStatus, warrantyUntil, type WarrantyStatus } from "@/lib/orders/service-warranty";

/** Kupiony sprzęt na karcie klienta: stan gwarancji i zlecenia serwisowe tego egzemplarza (po numerze seryjnym). */
export type CardDevice = ClientEquipmentItem & { warranty: WarrantyStatus; orders: SerialHistoryItem[] };

export type ClientEquipmentCardView = {
  /** Na gwarancji — najpierw kończące się najwcześniej (to o nie klient zwykle pyta). */
  active: CardDevice[];
  /** Po gwarancji i bez daty zakupu — najnowsze zakupy najpierw. */
  other: CardDevice[];
  /** Numery z faktur za naprawę, których nie ma wśród kupionego sprzętu (sprzęt kupiony gdzie indziej albo dawno). */
  repairsElsewhere: InvoiceRepairRef[];
};

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Czy sprzęt pasuje do szukania w karcie: model, symbol, numer seryjny, numer dokumentu (wszystkie słowa). */
export function cardDeviceMatches(d: ClientEquipmentItem, query: string): boolean {
  const words = query.trim().toLocaleLowerCase("pl-PL").split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [d.name, d.symbol ?? "", d.invoiceNumber, ...d.serials].join(" ").toLocaleLowerCase("pl-PL");
  const hayNorm = norm(hay);
  return words.every((w) => hay.includes(w) || (norm(w).length >= 3 && hayNorm.includes(norm(w))));
}

/**
 * Karta klienta z listy sprzętu: gwarancja liczona jak przy przyjęciu (okres modelu albo 24 mies. od daty dokumentu),
 * zlecenia dopięte po numerze seryjnym, naprawy bez zakupu na liście osobno.
 */
export function buildClientEquipmentCard(
  items: readonly ClientEquipmentItem[],
  orders: readonly SerialHistoryItem[],
  repairs: readonly InvoiceRepairRef[],
  warrantyMonths: ReadonlyMap<number, number>,
  today: Date
): ClientEquipmentCardView {
  const ordersBySerial = new Map<string, SerialHistoryItem[]>();
  for (const o of orders) {
    const k = o.serialNo ? norm(o.serialNo) : "";
    if (k.length >= 3) ordersBySerial.set(k, [...(ordersBySerial.get(k) ?? []), o]);
  }
  const devices: CardDevice[] = items.map((it) => {
    const until = it.invoiceDate ? warrantyUntil(it.invoiceDate, warrantyMonthsFor(it.twId, warrantyMonths)) : null;
    const mine = it.serials.flatMap((s) => ordersBySerial.get(norm(s)) ?? []);
    const unique = [...new Map(mine.map((o) => [o.id, o])).values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { ...it, warranty: warrantyStatus(until, today), orders: unique };
  });
  const active = devices
    .filter((d) => d.warranty.state === "active")
    .sort((a, b) => (a.warranty.until ?? "").localeCompare(b.warranty.until ?? "") || a.name.localeCompare(b.name, "pl"));
  const other = devices.filter((d) => d.warranty.state !== "active");
  const owned = new Set(items.flatMap((i) => i.serials.map(norm)));
  const seen = new Set<string>();
  const repairsElsewhere = repairs.filter((r) => {
    const k = norm(r.serial);
    if (owned.has(k) || seen.has(`${k}|${r.invoiceId}`)) return false;
    seen.add(`${k}|${r.invoiceId}`);
    return true;
  });
  return { active, other, repairsElsewhere };
}
