"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { IndividualOrder } from "@/types/database";
import { selectedSaveButtonLabel } from "@/lib/orders/queue-batch-notify";

export function ReceiveQueueSelectionBar({
  zamowienie,
  informacja,
  canSaveZamowienie = true,
  pending,
  onSaveZamowienie,
  onNotifyInformacja,
  onClear,
}: {
  zamowienie: IndividualOrder[];
  informacja: IndividualOrder[];
  canSaveZamowienie?: boolean;
  pending: boolean;
  onSaveZamowienie: () => void;
  onNotifyInformacja: () => void;
  onClear: () => void;
}) {
  const total = zamowienie.length + informacja.length;
  if (total === 0) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-violet-200/70",
        "bg-violet-50/95 px-3 py-2.5 backdrop-blur-md sm:px-4",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
      )}
      role="status"
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-950">
        <span className="flex size-5 items-center justify-center rounded-full bg-violet-200/80 text-[10px] font-bold text-violet-800" aria-hidden>
          {total}
        </span>
        zaznaczono
      </span>
      {zamowienie.length > 0 ? (
        <Button
          variant="primary"
          size="sm"
          className="min-h-11 sm:min-h-9"
          disabled={pending || !canSaveZamowienie}
          title={
            canSaveZamowienie
              ? undefined
              : "Wpisz ilość dostawy przy zaznaczonych zamówieniach"
          }
          onClick={onSaveZamowienie}
        >
          {selectedSaveButtonLabel(zamowienie.length)}
        </Button>
      ) : null}
      {informacja.length > 0 ? (
        <Button
          variant="primary"
          size="sm"
          className="min-h-11 bg-sky-600 hover:bg-sky-700 sm:min-h-9"
          disabled={pending}
          onClick={onNotifyInformacja}
        >
          Powiadom ({informacja.length})
        </Button>
      ) : null}
      <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-9" disabled={pending} onClick={onClear}>
        Odznacz
      </Button>
    </div>
  );
}
