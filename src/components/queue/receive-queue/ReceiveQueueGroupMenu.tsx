"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { batchNotifyButtonLabel } from "@/lib/orders/queue-batch-notify";
import type { IndividualOrder } from "@/types/database";

export function ReceiveQueueGroupMenu({
  groupIds,
  groupAllSelected,
  zamIds,
  infoIds,
  receiveQueue,
  pending,
  onToggleSelectAll,
  onSaveFullZamowienie,
  onNotifyInformacja,
}: {
  groupIds: string[];
  groupAllSelected: boolean;
  zamIds: string[];
  infoIds: string[];
  receiveQueue: IndividualOrder[];
  pending: boolean;
  onToggleSelectAll: (checked: boolean) => void;
  onSaveFullZamowienie: () => void;
  onNotifyInformacja: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (groupIds.length <= 1) return null;

  const items: Array<{ label: string; onClick: () => void; tone?: "sky" }> = [
    {
      label: groupAllSelected ? "Odznacz wszystkie" : `Zaznacz wszystkie (${groupIds.length})`,
      onClick: () => {
        onToggleSelectAll(!groupAllSelected);
        setOpen(false);
      },
    },
  ];

  if (zamIds.length > 0) {
    items.push({
      label: batchNotifyButtonLabel(receiveQueue, zamIds, { prefix: "Całość zamówień" }),
      onClick: () => {
        onSaveFullZamowienie();
        setOpen(false);
      },
    });
  }

  if (infoIds.length > 0) {
    items.push({
      label: batchNotifyButtonLabel(receiveQueue, infoIds, {
        prefix: "Powiadom informacje",
        unit: "osoba",
      }),
      onClick: () => {
        onNotifyInformacja();
        setOpen(false);
      },
      tone: "sky",
    });
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={pending}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600",
          "hover:border-slate-300 hover:bg-slate-50"
        )}
      >
        Grupa ▾
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={item.onClick}
              className={cn(
                "block w-full px-3 py-1.5 text-left text-xs font-medium hover:bg-slate-50",
                item.tone === "sky" ? "text-sky-800" : "text-slate-700"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
