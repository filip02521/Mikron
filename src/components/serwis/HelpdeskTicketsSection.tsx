"use client";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { HelpdeskTicket } from "@/lib/mikran-shop/helpdesk-parse";
import { toDateOnly } from "@/lib/orders/service-loaners";
import { formatAutomatDay } from "@/lib/orders/zd-automat-daily";

export type HelpdeskBoardData = {
  mode: "live" | "test" | "off";
  /** Otwarte zgłoszenia serwisanta, jeszcze bez zlecenia w OnTime. */
  tickets: HelpdeskTicket[];
  error: string | null;
};

const DELIVERY_LABEL: Record<number, string> = { 1: "klient wysyła", 2: "odbiera Mikran" };

export function helpdeskSearchText(t: HelpdeskTicket): string {
  return `${t.id} #${t.id} ${t.name} ${t.company} ${t.product} ${t.email} ${t.telephone}`.toLocaleLowerCase("pl-PL");
}

/** Zgłoszenia z helpdesku mikran.pl, które czekają na sprzęt — każde przyjmuje się jednym kliknięciem. */
export function HelpdeskTicketsSection({
  data,
  tickets,
  onAccept,
}: {
  data: HelpdeskBoardData;
  /** Zgłoszenia po filtrze szukania. */
  tickets: HelpdeskTicket[];
  onAccept: (helpdeskId: number) => void;
}) {
  const todayKey = toDateOnly(new Date());
  if (data.error) {
    return (
      <Alert tone="warning" title="Nie pobrano zgłoszeń z helpdesku">
        {`${data.error} Zlecenia poniżej są aktualne; sprzęt ze zgłoszenia przyjmiesz też po numerze w „Przyjmij sprzęt”.`}
      </Alert>
    );
  }
  if (!tickets.length) return null;
  return (
    <section aria-labelledby="grp-helpdesk" className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--sv-rule)] bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--sv-rule)] px-4 py-3 sm:px-5">
        <h2 id="grp-helpdesk" className="text-[0.9375rem] font-semibold text-slate-900">
          Do przyjęcia z helpdesku <span className="font-normal text-slate-500">· {tickets.length}</span>
        </h2>
        {data.mode === "test" ? <Badge variant="warning">Dane testowe</Badge> : null}
      </div>
      <ul className="divide-y divide-[var(--sv-rule)]">
        {tickets.map((t) => {
          const who = t.company || t.name || t.email;
          const day = /^\d{4}-\d{2}-\d{2}/.test(t.dateAdded) ? formatAutomatDay(t.dateAdded.slice(0, 10), todayKey) : null;
          const delivery = t.deliveryId ? DELIVERY_LABEL[t.deliveryId] : null;
          return (
            <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-xs font-semibold text-slate-500">#{t.id}</span>
                  <span className="text-[0.9375rem] font-semibold text-slate-900">{t.product || "Sprzęt bez nazwy"}</span>
                </span>
                <span className="text-[0.8125rem] text-slate-500">
                  {[who, t.status, day ? `zgłoszone ${day}` : null, delivery].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => onAccept(t.id)}>
                Przyjmij sprzęt
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
