import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { listRowClass } from "@/components/zakupy/asystent/workspace";
import { cn } from "@/lib/cn";
import { OC_STATUS_LABELS, type OcCheck, type OcCheckStatus } from "@/lib/oc-check/types";
import type { OcView } from "@/lib/oc-check/view";

export const OC_STATUS_VARIANT: Record<OcCheckStatus, "default" | "success" | "warning" | "info" | "danger"> = {
  zgodne: "success",
  rozbieznosci: "warning",
  czeka_na_nas: "info",
  brak_oc: "default",
  nie_da_sie: "default",
};

const shortFmt = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Warsaw",
});

/** Adres widoku kontroli OC, z wybraną sprawą albo bez. */
export function ocCheckHref(view: OcView, id?: string): string {
  const p = new URLSearchParams({ sekcja: "oc" });
  if (view !== "do-ruchu") p.set("widok", view);
  if (id) p.set("sprawa", id);
  return `/zakupy/asystent?${p.toString()}`;
}

export function OcCheckList({ checks, view, selectedId }: { checks: OcCheck[]; view: OcView; selectedId: string | null }) {
  return (
    <ul className="divide-y divide-slate-100">
      {checks.map((check) => {
        const selected = check.id === selectedId;
        const open = !check.resolvedAt && check.status !== "zgodne";
        return (
          <li key={check.id}>
            <Link href={ocCheckHref(view, check.id)} aria-current={selected ? "page" : undefined} className={listRowClass(selected)}>
              <span className="flex items-baseline justify-between gap-2">
                <span className={cn("min-w-0 truncate text-sm text-slate-900", open ? "font-semibold" : "font-medium")}>
                  {check.supplierName}
                </span>
                {check.ocReceivedAt ? (
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">{shortFmt.format(new Date(check.ocReceivedAt))}</span>
                ) : null}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant={OC_STATUS_VARIANT[check.status]}>{OC_STATUS_LABELS[check.status]}</Badge>
                {check.priority === 2 && !check.resolvedAt ? <Badge variant="danger">Pilne</Badge> : null}
                {check.ocNumber ? <span className="font-mono text-xs text-slate-600">OC {check.ocNumber}</span> : null}
              </span>
              <span className="mt-1 block truncate text-xs text-slate-500">
                {[
                  check.zdNumber ? `ZD ${check.zdNumber}` : "ZD nieprzypisane",
                  check.linesTotal !== null ? `${check.linesOk} z ${check.linesTotal} zgodnych` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {check.summary ? <span className="mt-0.5 block truncate text-sm text-slate-700">{check.summary}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
