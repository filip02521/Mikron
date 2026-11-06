"use client";

import { useEffect, useState } from "react";
import { actionServiceRelatedCases, type RelatedCasesResult } from "@/app/actions/service-orders";
import { Badge } from "@/components/ui/Badge";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { formatDateOnly, OrderStatusPill } from "@/components/serwis/service-order-view";
import { cn } from "@/lib/cn";
import type { HelpdeskTicket } from "@/lib/mikran-shop/helpdesk-parse";
import type { SerialHistoryItem, ServiceOrder } from "@/lib/orders/service-orders";
import { formatHelpdeskWhen, isPossibleDuplicateTicket } from "@/lib/orders/service-related-cases";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { rubricBoxClass, rubricHeadClass, rubricLabelClass } from "@/lib/ui/serwis-theme";

type Order = Pick<ServiceOrder, "id" | "clientKhId" | "clientName" | "serialNo" | "helpdeskId" | "deviceName">;

function short(text: string, max = 90): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Powiązane sprawy w karcie zlecenia: powroty tego samego egzemplarza, inne naprawy klienta i inne zgłoszenia
 * w helpdesku (klient zakłada drugie zgłoszenie w tej samej sprawie). Nic nie rysuje, gdy nic nie znaleziono.
 */
export function ServiceRelatedCases({
  order,
  canOpenOrder,
  onOpenOrder,
}: {
  order: Order;
  canOpenOrder: (id: string) => boolean;
  onOpenOrder: (id: string) => void;
}) {
  const { id, clientKhId, clientName, serialNo, helpdeskId } = order;
  const key = `${id}|${clientKhId}|${clientName}|${serialNo}|${helpdeskId}`;
  const [result, setResult] = useState<{ key: string; res: RelatedCasesResult } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    actionServiceRelatedCases({ orderId: id, clientKhId, clientName, serialNo, helpdeskId }).then(
      (res) => alive && setResult({ key, res }),
      () => alive && setResult({ key, res: { ok: false, message: "Nie udało się wczytać powiązanych spraw — brak połączenia z serwerem." } })
    );
    return () => {
      alive = false;
    };
  }, [key, id, clientKhId, clientName, serialNo, helpdeskId, attempt]);

  const res = result?.key === key ? result.res : null;
  if (!res) {
    return (
      <div role="status" className="flex items-center gap-3 px-1 py-1">
        <BrandLoader size="sm" tile={false} />
        <span className="text-[0.8125rem] text-slate-600">Szukam innych zleceń i zgłoszeń tego klienta…</span>
      </div>
    );
  }
  if (!res.ok) {
    return (
      <Box>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-[0.8125rem] text-amber-900">{res.message}</p>
          <Button type="button" variant="secondary" size="sm" className="min-h-11" onClick={() => {
              setResult(null);
              setAttempt((a) => a + 1);
            }}
          >
            Spróbuj ponownie
          </Button>
        </div>
      </Box>
    );
  }

  // Możliwe duplikaty na górze listy zgłoszeń — to je serwisant musi zauważyć; reszta w kolejności z helpdesku.
  const tickets = res.tickets
    .map((t) => ({ t, dup: isPossibleDuplicateTicket(t, order) }))
    .sort((a, b) => Number(b.dup) - Number(a.dup));
  if (!res.serialOrders.length && !res.clientOrders.length && !tickets.length && !res.helpdeskError) return null;

  return (
    <Box>
      <div className="-my-1 space-y-3">
        <Group title="Ten sam egzemplarz" items={res.serialOrders} canOpenOrder={canOpenOrder} onOpenOrder={onOpenOrder} />
        <Group title="Inne naprawy klienta" items={res.clientOrders} canOpenOrder={canOpenOrder} onOpenOrder={onOpenOrder} />
        {tickets.length ? (
          <div>
            <h4 className="text-[0.8125rem] font-semibold text-slate-900">Inne zgłoszenia w helpdesku · {tickets.length}</h4>
            <ul className="mt-1 divide-y divide-[var(--sv-rule)]">
              {tickets.map(({ t, dup }) => (
                <TicketRow key={t.id} ticket={t} duplicate={dup} />
              ))}
            </ul>
          </div>
        ) : null}
        {res.helpdeskError ? <p className="text-[0.8125rem] text-slate-600">Helpdesk: {res.helpdeskError}</p> : null}
      </div>
    </Box>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <section className={rubricBoxClass}>
      <div className={rubricHeadClass}>
        <h3 className={rubricLabelClass}>Powiązane sprawy</h3>
      </div>
      <div className="px-3 py-3">{children}</div>
    </section>
  );
}

function Group({
  title,
  items,
  canOpenOrder,
  onOpenOrder,
}: {
  title: string;
  items: SerialHistoryItem[];
  canOpenOrder: (id: string) => boolean;
  onOpenOrder: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="text-[0.8125rem] font-semibold text-slate-900">
        {title} · {items.length}
      </h4>
      <ul className="mt-1 divide-y divide-[var(--sv-rule)]">
        {items.map((o) => {
          const clickable = canOpenOrder(o.id);
          const body = (
            <>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={cn("font-mono text-xs font-semibold", clickable ? "text-indigo-700 underline underline-offset-2" : "text-slate-700")}>
                  {o.number}
                </span>
                <span className="text-xs tabular-nums text-slate-600">{formatDateOnly(o.createdAt.slice(0, 10))}</span>
                <OrderStatusPill status={o.status} />
              </span>
              <span className="block text-[0.8125rem] text-slate-800">
                {o.deviceName}
                {o.fault.trim() ? <span className="text-slate-600"> · {short(o.fault)}</span> : null}
              </span>
            </>
          );
          return (
            <li key={o.id}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onOpenOrder(o.id)}
                  className={cn("-mx-2 block min-h-11 w-[calc(100%+1rem)] rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-[var(--sv-box)]", controlFocusClass)}
                >
                  {body}
                </button>
              ) : (
                <div className="py-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TicketRow({ ticket: t, duplicate }: { ticket: HelpdeskTicket; duplicate: boolean }) {
  const who = t.company || t.name || t.email;
  const day = t.dateAdded ? formatHelpdeskWhen(t.dateAdded).slice(0, 10) : "";
  return (
    <li className="py-1.5">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-xs font-semibold text-slate-700">#{t.id}</span>
        {duplicate ? <Badge variant="warning">możliwy duplikat</Badge> : null}
        {t.status ? <Badge>{t.status}</Badge> : null}
        {day ? <span className="text-xs tabular-nums text-slate-600">{day}</span> : null}
      </span>
      <span className="block text-[0.8125rem] text-slate-800">
        {t.product || "Sprzęt bez nazwy"}
        {who ? <span className="text-slate-600"> · {who}</span> : null}
      </span>
    </li>
  );
}
