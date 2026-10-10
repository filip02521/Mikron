"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionUpdateSalesNote, actionUpdateZkWatchFollowUp } from "@/app/actions/sales-notepad";
import { cn } from "@/lib/cn";
import { addDaysToIso, todayIso } from "@/lib/sales/notepad-follow-up";
import { isBusinessDay } from "@/lib/orders/business-calendar";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import type { SalesDayStartItem } from "@/lib/sales/sales-day-start";

function nextBusinessDayIso(): string {
  let value = addDaysToIso(todayIso(), 1);
  while (!isBusinessDay(new Date(`${value}T12:00:00`))) value = addDaysToIso(value, 1);
  return value;
}

const actionClass =
  "rounded-md px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 disabled:opacity-50";

/** Załatwienie przypomnienia bez wychodzenia z panelu Pilne sprawy. */
export function SalesDayStartReminderActions({
  reminder,
  onDone,
}: {
  reminder: NonNullable<SalesDayStartItem["reminder"]>;
  onDone: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const setFollowUp = (followUpAt: string | null) =>
    start(async () => {
      setError(null);
      try {
        if (reminder.kind === "zk") {
          await actionUpdateZkWatchFollowUp(reminder.id, followUpAt);
        } else {
          await actionUpdateSalesNote(reminder.id, { follow_up_at: followUpAt });
        }
        await onDone();
        router.refresh();
      } catch (e) {
        setError(userFacingErrorText(e, "Nie udało się zapisać przypomnienia."));
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/50 px-3 py-2 sm:px-4">
      <button
        type="button"
        className={actionClass}
        disabled={pending}
        title="Usuń przypomnienie"
        onClick={() => setFollowUp(null)}
      >
        Zrobione
      </button>
      <button
        type="button"
        className={actionClass}
        disabled={pending}
        title="Przypomnij w następny dzień roboczy"
        onClick={() => setFollowUp(nextBusinessDayIso())}
      >
        Jutro
      </button>
      {error ? (
        <span role="alert" className={cn("text-xs text-rose-700")}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
