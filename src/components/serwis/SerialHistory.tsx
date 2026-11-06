"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { actionServiceSerialHistory } from "@/app/actions/service-orders";
import { formatLocalDate, OrderStatusPill } from "@/components/serwis/service-order-view";
import { serialKey, type SerialHistoryItem } from "@/lib/orders/service-orders";

/** Pierwsze zdanie, przycięte — w historii wystarczy, co było nie tak i co zrobiono. */
function short(text: string, max = 90): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Wcześniejsze zlecenia tego samego egzemplarza (po numerze seryjnym). Nic nie pokazuje, dopóki numer jest za krótki
 * albo historii nie ma — przy przyjęciu nie zajmuje miejsca dla sprzętu, który jest u nas pierwszy raz.
 */
export function SerialHistory({
  serial,
  excludeOrderId = null,
  onOpenOrder,
  canOpenOrder,
  className,
}: {
  serial: string | null;
  excludeOrderId?: string | null;
  /** W panelu zlecenia: wcześniejsze zlecenie otwiera się kliknięciem. Przy przyjęciu — sam tekst. */
  onOpenOrder?: (orderId: string) => void;
  /** Które zlecenia da się otworzyć (są na tablicy); pozostałe zostają tekstem z numerem. */
  canOpenOrder?: (orderId: string) => boolean;
  className?: string;
}) {
  const key = serialKey(serial);
  const [result, setResult] = useState<{ key: string; items: SerialHistoryItem[] } | null>(null);

  useEffect(() => {
    if (key.length < 4) return;
    let alive = true;
    // Przy wpisywaniu numeru z klawiatury pyta dopiero po chwili przerwy, nie po każdym znaku.
    const t = window.setTimeout(() => {
      actionServiceSerialHistory({ serial: key, excludeOrderId }).then(
        (res) => alive && setResult({ key, items: res.ok ? res.items : [] }),
        () => alive && setResult({ key, items: [] })
      );
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [key, excludeOrderId]);

  const items = result && result.key === key && key.length >= 4 ? result.items : [];
  if (!items.length) return null;

  return (
    <section aria-label="Wcześniej w serwisie" className={cn("space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3", className)}>
      <div className="text-sm font-semibold text-amber-900">
        Ten egzemplarz był już w serwisie: {items.length}×{items.length === 5 ? " (ostatnie 5)" : ""}
      </div>
      <ul className="space-y-1.5">
        {items.map((o) => {
          const body = (
            <>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-xs font-semibold text-slate-700">{o.number}</span>
                <span className="text-xs text-slate-600">{formatLocalDate(o.createdAt)}</span>
                <OrderStatusPill status={o.status} />
              </span>
              <span className="block text-[0.8125rem] text-slate-800">{short(o.fault)}</span>
              {o.workNote.trim() ? <span className="block text-[0.8125rem] text-slate-600">Zrobiono: {short(o.workNote)}</span> : null}
            </>
          );
          return (
            <li key={o.id}>
              {onOpenOrder && (canOpenOrder?.(o.id) ?? true) ? (
                <button
                  type="button"
                  onClick={() => onOpenOrder(o.id)}
                  className="block min-h-11 w-full rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-amber-100"
                >
                  {body}
                </button>
              ) : (
                <div className="px-2 py-1">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
