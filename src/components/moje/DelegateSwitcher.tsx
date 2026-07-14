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

export type DelegateSwitcherSurface = "moje" | "zk" | "notatnik";

const SURFACE_BASE_HREF: Record<DelegateSwitcherSurface, string> = {
  moje: "/moje",
  zk: "/zk",
  notatnik: "/notatnik",
};

const SURFACE_LABEL: Record<DelegateSwitcherSurface, string> = {
  moje: "panelu zamówień",
  zk: "ZK czekających",
  notatnik: "notatnika",
};

export function DelegateSwitcher({
  delegations,
  activeDelegateFor,
  surface = "moje",
}: {
  delegations: VacationDelegationRow[];
  activeDelegateFor: string | null;
  surface?: DelegateSwitcherSurface;
}) {
  const searchParams = useSearchParams();

  if (!delegations.length) return null;

  const activeDelegation = activeDelegateFor
    ? delegations.find((d) => d.salesPersonId === activeDelegateFor)
    : null;

  if (activeDelegation) {
    const otherDelegations = delegations.filter(
      (d) => d.salesPersonId !== activeDelegateFor
    );
    if (otherDelegations.length === 0) return null;

    return (
      <SystemNotice
        variant="action"
        className="mb-4"
        title={
          <span className="inline-flex items-center gap-2">
            <IconSun size={16} className="text-amber-500" />
            {`Inne aktywne zastępstwa (${otherDelegations.length})`}
          </span>
        }
        description={
          <span>
            <span className="font-medium text-slate-700">Przełącz na innego handlowca</span>
            <span className="mt-0.5 block">Masz kilka aktywnych zastępstw — wybierz, czyj {SURFACE_LABEL[surface]} chcesz otworzyć.</span>
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            {otherDelegations.map((d) => {
              const href = `${SURFACE_BASE_HREF[surface]}?dla=${d.salesPersonId}`;
              return (
                <Link key={d.id} href={href}>
                  <Button
                    size="sm"
                    variant="outline"
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
          ? `Aktywne zastępstwo do ${delegations[0].endDate}. Przejdź do ${SURFACE_LABEL[surface]} handlowca, aby potwierdzać odbiory i zamykać ZK.`
          : `Wybierz ${SURFACE_LABEL[surface]} handlowca do przełączenia. Możesz potwierdzać odbiory i zamykać ZK.`
      }
      action={
        <div className="flex flex-wrap gap-2">
          {delegations.map((d) => {
            const href = `${SURFACE_BASE_HREF[surface]}?dla=${d.salesPersonId}`;
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
