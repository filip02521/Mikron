"use client";

import { useState, useTransition } from "react";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { IconChevronRight, IconSearch } from "@/components/icons/StrokeIcons";
import { actionServiceHelpdeskSearch } from "@/app/actions/service-orders";
import { parseHelpdeskNumber, type HelpdeskTicket } from "@/lib/mikran-shop/helpdesk-parse";
import type { HelpdeskLinkedOrder } from "@/lib/data/service-orders";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { rubricBoxClass } from "@/lib/ui/serwis-theme";
import { pickerInputClass } from "@/components/serwis/SubiektPickers";
import { DELIVERY_LABEL } from "@/components/serwis/HelpdeskTicketsSection";
import { linkedOrderLine, matchHelpdeskTickets } from "@/components/serwis/helpdesk-intake";

type Linked = Readonly<Record<number, readonly HelpdeskLinkedOrder[]>>;

function TicketRow({ ticket: t, orders, onPick }: { ticket: HelpdeskTicket; orders: readonly HelpdeskLinkedOrder[]; onPick: () => void }) {
  const who = t.company || t.name || t.email;
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={cn("group flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-[var(--sv-box)]", controlFocusClass)}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-xs font-semibold text-slate-500">#{t.id}</span>
            <span className="text-sm font-semibold text-slate-900">{t.product || "Sprzęt bez nazwy"}</span>
          </span>
          <span className="text-[0.8125rem] text-slate-500">
            {[who, t.status, t.deliveryId ? DELIVERY_LABEL[t.deliveryId] : null].filter(Boolean).join(" · ")}
          </span>
          {orders.length ? <span className="text-[0.8125rem] text-amber-900">Przyjęto już: {orders.map(linkedOrderLine).join("; ")}</span> : null}
        </span>
        <IconChevronRight size={16} className="shrink-0 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
      </button>
    </li>
  );
}

/**
 * Wybór zgłoszenia przy przyjęciu: otwarte zgłoszenia z tablicy filtrowane w trakcie pisania,
 * numer wczytuje wprost, a „Szukaj w całym helpdesku” sięga po wszystkie statusy i osoby.
 */
export function HelpdeskTicketPicker({
  inputId,
  tickets,
  linked,
  autoFocus,
  onPick,
}: {
  inputId: string;
  /** Otwarte zgłoszenia z tablicy. */
  tickets: readonly HelpdeskTicket[];
  linked: Linked;
  autoFocus?: boolean;
  /** Wybrane zgłoszenie (z listy) albo sam numer wpisany przez serwisanta. */
  onPick: (helpdeskId: number, ticket: HelpdeskTicket | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<{ q: string; tickets: (HelpdeskTicket & { orders: HelpdeskLinkedOrder[] })[] } | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const q = query.trim();
  const local = matchHelpdeskTickets(tickets, q, linked);
  const number = parseHelpdeskNumber(q);
  const numberTicket = number ? tickets.find((t) => t.id === number) ?? null : null;
  const shownRemote = remote && remote.q === q ? remote.tickets : null;

  const search = () => {
    if (q.length < 2) {
      setRemoteError("Wpisz co najmniej 2 znaki: klienta, sprzęt, numer seryjny albo telefon.");
      return;
    }
    setRemoteError(null);
    startSearch(async () => {
      const res = await actionServiceHelpdeskSearch(q);
      if (!res.ok) {
        setRemote(null);
        setRemoteError(`${res.message} Wpisz numer zgłoszenia albo przyjmij sprzęt bez zgłoszenia.`);
      } else setRemote({ q, tickets: res.tickets });
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Szukaj zgłoszenia</span>
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            id={inputId}
            type="search"
            value={query}
            autoFocus={autoFocus}
            maxLength={80}
            placeholder="Klient, sprzęt, SN, nr zgłoszenia"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter wybiera / szuka zgłoszenia, nie wysyła formularza przyjęcia.
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (number) onPick(number, numberTicket);
              else if (local.length === 1) onPick(local[0]!.id, local[0]!);
              else if (!local.length) search();
            }}
            className={`${pickerInputClass} pl-9`}
          />
        </label>
        <Button type="button" variant="secondary" disabled={searching} onClick={search}>
          {searching ? "Szukam…" : "Szukaj w całym helpdesku"}
        </Button>
      </div>

      {number && !numberTicket ? (
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => onPick(number, null)}>
          Wczytaj zgłoszenie #{number}
        </Button>
      ) : null}

      {local.length ? (
        <div className={cn(rubricBoxClass, "max-h-72 overflow-y-auto")}>
          <p className="border-b border-[var(--sv-rule)] px-3 py-1.5 text-xs text-slate-500">
            {q ? `Otwarte zgłoszenia pasujące do „${q}” · ${local.length}` : `Otwarte zgłoszenia · ${local.length}`}
          </p>
          <ul className="divide-y divide-[var(--sv-rule)]">
            {local.map((t) => (
              <TicketRow key={t.id} ticket={t} orders={linked[t.id] ?? []} onPick={() => onPick(t.id, t)} />
            ))}
          </ul>
        </div>
      ) : q && !number && !shownRemote && !searching ? (
        <p className="text-[0.8125rem] text-slate-600">Wśród otwartych zgłoszeń nic nie pasuje. Naciśnij Enter albo „Szukaj w całym helpdesku”.</p>
      ) : null}

      {searching ? (
        <p role="status" className="flex items-center gap-2 text-[0.8125rem] text-slate-600">
          <BrandLoader size="sm" tile={false} />
          Szukam „{q}” w całym helpdesku mikran.pl — zwykle kilka sekund…
        </p>
      ) : remoteError ? (
        <p role="alert" className="text-[0.8125rem] text-red-700">
          {remoteError}
        </p>
      ) : shownRemote ? (
        shownRemote.length ? (
          <div className={cn(rubricBoxClass, "max-h-72 overflow-y-auto")}>
            <p className="border-b border-[var(--sv-rule)] px-3 py-1.5 text-xs text-slate-500">
              W całym helpdesku (wszystkie statusy) · {shownRemote.length}
            </p>
            <ul className="divide-y divide-[var(--sv-rule)]">
              {shownRemote.map((t) => (
                <TicketRow key={t.id} ticket={t} orders={t.orders} onPick={() => onPick(t.id, t)} />
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[0.8125rem] text-slate-600">
            W helpdesku nie ma zgłoszenia pasującego do „{q}”. Sprawdź pisownię, wpisz numer zgłoszenia albo przyjmij bez zgłoszenia.
          </p>
        )
      ) : null}
    </div>
  );
}
