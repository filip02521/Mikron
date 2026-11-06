import { cn } from "@/lib/cn";
import type { EventTimelineTone } from "@/components/ui/EventTimeline";
import {
  SERVICE_ORDER_STATUS_LABEL,
  type ServiceOrder,
  type ServiceOrderEvent,
  type ServiceOrderGroup,
  type ServiceOrderPart,
  type ServiceOrderStatus,
} from "@/lib/orders/service-orders";
import { warrantyLabel, type WarrantyStatus } from "@/lib/orders/service-warranty";

export type OrderPartView = ServiceOrderPart & { orderId: string };

/** Egzemplarz zamiennika, który można powiązać ze zleceniem (jest u klienta). */
export type LinkableLoaner = { id: string; code: string; twName: string; clientName: string | null; khId: number | null };

export type ModelPartView = { modelTwId: number; partTwId: number; partSymbol: string | null; partName: string; defaultQty: number };

export const ORDER_GROUP_LABEL: Record<ServiceOrderGroup, string> = {
  czeka_na_czesc: "Czeka na część",
  w_serwisie: "W serwisie",
  gotowe: "Gotowe do wydania",
  dokumenty: "Brak dokumentów",
  zamkniete: "Zamknięte",
};

const STATUS_PILL: Record<ServiceOrderStatus, string> = {
  przyjete: "bg-slate-100 text-slate-700",
  diagnoza: "bg-indigo-50 text-indigo-800",
  czeka_na_akceptacje: "bg-amber-50 text-amber-900",
  w_naprawie: "bg-indigo-50 text-indigo-800",
  czeka_na_czesc: "bg-amber-50 text-amber-900",
  gotowe: "bg-emerald-50 text-emerald-800",
  wydane: "bg-slate-100 text-slate-600",
  anulowane: "bg-slate-100 text-slate-500",
};

export function OrderStatusPill({ status }: { status: ServiceOrderStatus }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium", STATUS_PILL[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {SERVICE_ORDER_STATUS_LABEL[status]}
    </span>
  );
}

const WARRANTY_PILL: Record<WarrantyStatus["state"], string> = {
  active: "bg-emerald-50 text-emerald-800",
  expired: "bg-amber-50 text-amber-900",
  unknown: "bg-slate-100 text-slate-600",
};

/** Stan gwarancji jako płaska odznaka (nie przycisk): „Gwarancja do …”, „Po gwarancji (…)”, „Brak daty zakupu”. */
export function WarrantyPill({ status, className }: { status: WarrantyStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium",
        WARRANTY_PILL[status.state],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {warrantyLabel(status)}
    </span>
  );
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
}

export function formatDateOnly(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

export function daysSince(iso: string, today: Date): number {
  const a = new Date(iso);
  const from = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

const EVENT_TONE: Record<ServiceOrderEvent["type"], EventTimelineTone> = {
  created: "neutral",
  status: "brand",
  part_taken: "warn",
  part_returned: "muted",
  loaner_linked: "brandSoft",
  loaner_unlinked: "muted",
  rw: "ok",
  note: "neutral",
  invoice: "ok",
  invoice_cleared: "muted",
  waiting_part: "warn",
  quote: "warn",
  quote_decision: "brand",
  shipment: "ok",
};

export function orderEventTone(e: ServiceOrderEvent): EventTimelineTone {
  if (e.type === "status" && e.toStatus === "anulowane") return "danger";
  if (e.type === "status" && (e.toStatus === "gotowe" || e.toStatus === "wydane")) return "ok";
  if (e.type === "status" && e.toStatus === "czeka_na_czesc") return "warn";
  return EVENT_TONE[e.type];
}

export function orderEventTitle(e: ServiceOrderEvent): string {
  switch (e.type) {
    case "created":
      return "Przyjęto sprzęt";
    case "status":
      return e.toStatus ? SERVICE_ORDER_STATUS_LABEL[e.toStatus] : "Zmiana statusu";
    case "part_taken":
      return `Pobrano: ${e.note}`;
    case "part_returned":
      return `Oddano: ${e.note}`;
    case "loaner_linked":
      return `Zamiennik ${e.note}`;
    case "loaner_unlinked":
      // Odpięcie przy zwrocie egzemplarza ma notatkę „ZAST-001 zwrócony”, ręczne — pustą.
      return e.note ? `Zamiennik ${e.note}` : "Odpięto zamiennik";
    case "rw":
      return `RW ${e.note.replace(/^RW\s*/i, "")}`;
    case "invoice":
      return e.note.startsWith("Bez faktury") ? e.note : `Faktura ${e.note}`.trim();
    case "invoice_cleared":
      return e.note ? `Usunięto fakturę (${e.note})` : "Usunięto fakturę";
    case "waiting_part":
      return e.note ? `Czeka na: ${e.note}` : "Czeka na część";
    case "quote":
      return e.note ? `Wycena: ${e.note}` : "Wycena wysłana";
    case "quote_decision":
      return e.note || "Decyzja klienta";
    case "shipment":
      return e.note ? `Wydano: ${e.note}` : "Wydano klientowi";
    case "note":
      return e.note || "Notatka";
  }
}

export function orderEventMeta(e: ServiceOrderEvent): string {
  const parts: string[] = [];
  if (e.type === "created" && e.note) parts.push(e.note);
  if (e.type === "status" && e.note) parts.push(e.note);
  if (e.actorName) parts.push(e.actorName);
  return parts.join(" · ");
}

export function orderSearchText(o: ServiceOrder): string {
  const helpdesk = o.helpdeskId ? `${o.helpdeskId} #${o.helpdeskId}` : "";
  return `${o.number} ${o.clientName} ${o.deviceName} ${o.deviceSymbol ?? ""} ${o.serialNo ?? ""} ${o.rwNumber ?? ""} ${helpdesk}`.toLocaleLowerCase("pl-PL");
}

/** Status prośby do zakupów po polsku (lista części, „czeka na część” w zleceniu). */
export const REQUEST_STATUS_LABEL: Record<string, string> = {
  Nowe: "nowa prośba",
  Weryfikacja: "w weryfikacji",
  Zamowione: "zamówione",
  Czesciowo_zrealizowane: "częściowo dostarczone",
  Zrealizowane: "dostarczone",
  Anulowane: "anulowana",
};
