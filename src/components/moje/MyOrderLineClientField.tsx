"use client";

import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { SalesClientNameEditor } from "@/components/moje/SalesClientNameEditor";
import { cn } from "@/lib/cn";
import { brandLinkSubtleClass } from "@/lib/ui/ontime-theme";

import type { SalesClientAssignment } from "@/lib/orders/sales-client-label";

/** Przypisanie klienta do jednej pozycji (produktu) w grupie. */
export function MyOrderLineClientField({
  clientName,
  clientKhId = null,
  disabled,
  editing,
  className,
  onStartEdit,
  onSave,
}: {
  clientName: string | null;
  clientKhId?: number | null;
  disabled?: boolean;
  editing: boolean;
  className?: string;
  onStartEdit: () => void;
  onSave: (patch: SalesClientAssignment) => void | Promise<void>;
}) {
  if (editing) {
    return (
      <SalesClientNameEditor
        value={clientName}
        clientKhId={clientKhId}
        disabled={disabled}
        openOnMount
        onSave={onSave}
      />
    );
  }

  const trimmed = clientName?.trim() || null;

  if (trimmed) {
    return (
      <div
        className={cn(
          "mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5",
          className
        )}
      >
        <MyOrderAssignedClient name={trimmed} className="min-w-0" />
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[0.68rem]">
          <button
            type="button"
            disabled={disabled}
            onClick={onStartEdit}
            className={cn("font-medium", brandLinkSubtleClass)}
          >
            Zmień
          </button>
          <span className="text-slate-200" aria-hidden>
            ·
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onSave({ clientName: null, clientKhId: null })}
            className="font-medium text-red-700 hover:text-red-900 disabled:opacity-50"
          >
            Usuń
          </button>
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onStartEdit}
      className={cn(
        "mt-1 text-left text-[0.68rem] font-medium disabled:opacity-50",
        brandLinkSubtleClass,
        className
      )}
    >
      Przypisz klienta
    </button>
  );
}
