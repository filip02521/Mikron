"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { salesTouchTargetClass } from "@/lib/ui/ontime-theme";
import { IconSun } from "@/components/icons/StrokeIcons";
import type { VacationDelegationRow } from "@/lib/data/vacation-delegations";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function DelegateSwitcher({
  delegations,
  activeDelegateFor,
}: {
  delegations: VacationDelegationRow[];
  activeDelegateFor: string | null;
}) {
  const searchParams = useSearchParams();

  if (!delegations.length) return null;

  const activeDelegation = activeDelegateFor
    ? delegations.find((d) => d.salesPersonId === activeDelegateFor)
    : null;

  if (activeDelegation) {
    const dateRange = activeDelegation.startDate && activeDelegation.endDate
      ? `${activeDelegation.startDate} → ${activeDelegation.endDate}`
      : `do ${activeDelegation.endDate}`;
    return (
      <SystemNotice
        variant="action"
        className="mb-4"
        title={
          <span className="inline-flex items-center gap-2">
            <IconSun size={16} className="text-amber-500" />
            {`Zastępujesz: ${activeDelegation.salesPersonName}`}
          </span>
        }
        description={
          <span>
            <span className="font-medium text-slate-700">Aktywne zastępstwo: {dateRange}</span>
            <span className="mt-0.5 block">Możesz potwierdzać odbiory i zamykać ZK. Edycja i anulowanie są wyłączone.</span>
          </span>
        }
        action={
          <Link href="/moje">
            <Button size="sm" variant="outline" className={salesTouchTargetClass}>
              Wróć do mojego panelu
            </Button>
          </Link>
        }
      />
    );
  }

  const currentDla = searchParams.get("dla");

  return (
    <SystemNotice
      variant="action"
      className="mb-4"
      title={
        <span className="inline-flex items-center gap-2">
          <IconSun size={16} className="text-amber-500" />
          {delegations.length === 1
            ? `Zastępujesz: ${delegations[0].salesPersonName}`
            : `Aktywne zastępstwa (${delegations.length})`}
        </span>
      }
      description={
        delegations.length === 1
          ? `Aktywne zastępstwo do ${delegations[0].endDate}. Przejdź do panelu handlowca, aby potwierdzać odbiory i zamykać ZK.`
          : "Wybierz panel handlowca do przełączenia. Możesz potwierdzać odbiory i zamykać ZK."
      }
      action={
        <div className="flex flex-wrap gap-2">
          {delegations.map((d) => {
            const href = `/moje?dla=${d.salesPersonId}`;
            const isActive = currentDla === d.salesPersonId;
            return (
              <Link key={d.id} href={href}>
                <Button
                  size="sm"
                  variant={isActive ? "secondary" : "outline"}
                  className={salesTouchTargetClass}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[9px] font-semibold text-violet-700"
                      aria-hidden
                    >
                      {initialsFromName(d.salesPersonName)}
                    </span>
                    <span>{d.salesPersonName}</span>
                    <span className="text-[10px] font-normal text-slate-400">do {d.endDate}</span>
                  </span>
                </Button>
              </Link>
            );
          })}
        </div>
      }
    />
  );
}
