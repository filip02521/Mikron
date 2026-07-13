"use client";

import Link from "next/link";
import type { SalesPersonAdminRow } from "@/lib/data/sales-people-admin";
import {
  formatSalesPersonAccountStatus,
  formatSalesPersonAccountStatusTitle,
} from "@/lib/data/sales-people-admin";
import type { SalesGroupRow } from "@/lib/data/sales-groups";
import type { SalesTeamUiContext } from "@/lib/sales/team-ui";
import { groupSalesPeopleForTeamView } from "@/lib/sales/team-grouping";
import { formatPrzypomnienieCount } from "@/lib/sales/team-plural";
import { buildNotatnikPageHref } from "@/lib/sales/notepad-page-tabs";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AddButton } from "@/components/ui/AddButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconUsers, IconClipboardList, IconNotebook, IconFilePlus, IconEye, IconMail, IconCircleCheck } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

function TeamCardActionLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("block min-w-0", className)}>
      {children}
    </Link>
  );
}

function SalesPersonCardActions({
  rowId,
  isSelf,
  prosbaReadOnly = false,
}: {
  rowId: string;
  isSelf: boolean;
  prosbaReadOnly?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5">
      <TeamCardActionLink href={`/moje?dla=${rowId}`}>
        <Button
          size="sm"
          variant={isSelf ? "primary" : "secondary"}
          className="h-9 w-full gap-1.5 px-2 text-xs"
        >
          <IconClipboardList size={14} className="shrink-0" />
          {isSelf ? "Moje zamówienia" : "Zobacz prośby"}
        </Button>
      </TeamCardActionLink>
      <TeamCardActionLink
        href={buildNotatnikPageHref({ extraParams: { dla: rowId } })}
      >
        <Button size="sm" variant="outline" className="h-9 w-full gap-1.5 px-2 text-xs">
          <IconClipboardList size={14} className="shrink-0" />
          ZK czekające
        </Button>
      </TeamCardActionLink>
      <TeamCardActionLink
        href={buildNotatnikPageHref({
          tab: "notes",
          surface: "notes",
          extraParams: { dla: rowId },
        })}
      >
        <Button size="sm" variant="outline" className="h-9 w-full gap-1.5 px-2 text-xs">
          <IconNotebook size={14} className="shrink-0" />
          Notatnik
        </Button>
      </TeamCardActionLink>
      {!isSelf ? (
        <TeamCardActionLink href={`/prosba?dla=${rowId}`}>
          <Button size="sm" variant="outline" className="h-9 w-full gap-1.5 px-2 text-xs">
            {prosbaReadOnly ? <IconEye size={14} className="shrink-0" /> : <IconFilePlus size={14} className="shrink-0" />}
            {prosbaReadOnly ? "Podgląd formularza" : "Nowa prośba"}
          </Button>
        </TeamCardActionLink>
      ) : null}
    </div>
  );
}

function SalesPersonCard({
  row,
  isSelf,
  prosbaReadOnly = false,
}: {
  row: SalesPersonAdminRow;
  isSelf: boolean;
  prosbaReadOnly?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm transition hover:shadow-md",
        isSelf && "ring-1 ring-indigo-200/80"
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-bold ring-1 ring-inset",
              isSelf
                ? "bg-indigo-100 text-indigo-700 ring-indigo-200/60"
                : "bg-slate-100 text-slate-600 ring-slate-200/60"
            )}
            aria-hidden
          >
            {row.name.charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className={cn(salesTypography.rowTitle, "truncate")}>{row.name}</h3>
              {isSelf ? (
                <Badge variant="info" className="shrink-0 text-[10px]">
                  Ty
                </Badge>
              ) : row.groupName ? (
                <Badge variant="default" className="shrink-0 text-[10px]">
                  {row.groupName}
                </Badge>
              ) : null}
            </div>
            <p className={cn(salesTypography.rowMeta, "mt-0.5 truncate")}>{row.email}</p>
          </div>
        </div>
      </div>
      <div className="space-y-3 px-4 py-3">
        <dl className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-slate-50/80 px-2.5 py-2">
            <dt className={salesTypography.statLabel}>Zamówienia</dt>
            <dd className={cn(salesTypography.statValue, "tabular-nums")}>{row.orderCount}</dd>
          </div>
          <div className={cn(
            "rounded-md px-2.5 py-2",
            row.pendingZkCount > 0 ? "bg-amber-50/80" : "bg-slate-50/80"
          )}>
            <dt className={salesTypography.statLabel}>Czeka na towar</dt>
            <dd className={cn(salesTypography.statValue, "tabular-nums")}>
              {row.pendingZkCount > 0 ? (
                <Link
                  href={buildNotatnikPageHref({ extraParams: { dla: row.id } })}
                  className="text-amber-800 underline decoration-amber-300 underline-offset-2 hover:text-amber-950"
                >
                  {row.pendingZkCount}
                </Link>
              ) : (
                row.pendingZkCount
              )}
            </dd>
          </div>
          <div className={cn(
            "rounded-md px-2.5 py-2",
            row.followUpDueZkCount > 0 ? "bg-violet-50/80" : "bg-slate-50/80"
          )}>
            <dt className={salesTypography.statLabel}>Przyp. ZK</dt>
            <dd className={cn(salesTypography.statValue, "tabular-nums")}>
              {row.followUpDueZkCount > 0 ? (
                <Link
                  href={buildNotatnikPageHref({ extraParams: { dla: row.id } })}
                  className="text-violet-800 underline decoration-violet-200 underline-offset-2 hover:text-violet-950"
                >
                  {row.followUpDueZkCount}
                </Link>
              ) : (
                row.followUpDueZkCount
              )}
            </dd>
          </div>
          <div className={cn(
            "rounded-md px-2.5 py-2",
            row.followUpDueNotesCount > 0 ? "bg-indigo-50/80" : "bg-slate-50/80"
          )}>
            <dt className={salesTypography.statLabel}>Przyp. not.</dt>
            <dd className={cn(salesTypography.statValue, "tabular-nums")}>
              {row.followUpDueNotesCount > 0 ? (
                <Link
                  href={buildNotatnikPageHref({
                    tab: "notes",
                    surface: "notes",
                    extraParams: { dla: row.id },
                  })}
                  className="text-indigo-800 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-950"
                >
                  {row.followUpDueNotesCount}
                </Link>
              ) : (
                row.followUpDueNotesCount
              )}
            </dd>
          </div>
        </dl>
        <div className={cn(
          "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs",
          row.linkedUserEmail
            ? "border-emerald-100/80 bg-emerald-50/40 text-slate-700"
            : "border-slate-100 bg-slate-50/40 text-slate-500"
        )}>
          {row.linkedUserEmail ? (
            <IconCircleCheck size={14} className="shrink-0 text-emerald-600" />
          ) : (
            <IconMail size={14} className="shrink-0 text-slate-400" />
          )}
          <span className="min-w-0 truncate" title={formatSalesPersonAccountStatusTitle(row)}>
            {formatSalesPersonAccountStatus(row)}
          </span>
        </div>
        <SalesPersonCardActions
          rowId={row.id}
          isSelf={isSelf}
          prosbaReadOnly={prosbaReadOnly}
        />
      </div>
    </div>
  );
}

export function SalesTeamOverview({
  rows,
  groups,
  managerSalesPersonId,
  teamUi,
  loadError,
}: {
  rows: SalesPersonAdminRow[];
  groups: SalesGroupRow[];
  managerSalesPersonId: string | null;
  teamUi?: SalesTeamUiContext;
  loadError?: string | null;
}) {
  if (loadError) return null;

  const prosbaReadOnly = Boolean(teamUi?.isAdmin || teamUi?.readOnlyPreview);
  if (!rows.length) {
    const emptyDescription = teamUi?.isManager
      ? teamUi.hasTeamScope
        ? `Dodaj pierwszą osobę w sekcji Handlowcy i przypisz do grupy (${teamUi.groupNamesLabel}).`
        : "Po przypisaniu grup przez administratora dodasz tu handlowców."
      : "Dodaj pierwszą osobę w sekcji Handlowcy oraz przypisz grupę (Sklep / Biuro).";

    return (
      <EmptyState
        title="Brak handlowców"
        description={emptyDescription}
        action={
          teamUi?.readOnlyPreview || (teamUi?.isManager && !teamUi.hasTeamScope) ? undefined : (
            <Link href="/zespol/handlowcy">
              <AddButton variant="primary">Dodaj handlowca</AddButton>
            </Link>
          )
        }
      />
    );
  }

  const sections = groupSalesPeopleForTeamView(rows, groups);
  const totalFollowUpDue = rows.reduce((sum, row) => sum + row.followUpDueZkCount, 0);
  const totalNotesFollowUpDue = rows.reduce((sum, row) => sum + row.followUpDueNotesCount, 0);
  const totalPending = rows.reduce((sum, row) => sum + row.pendingZkCount, 0);

  return (
    <div className="space-y-8">
      {totalPending > 0 || totalFollowUpDue > 0 || totalNotesFollowUpDue > 0 ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {totalPending > 0 ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                <IconClipboardList size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-amber-900">ZK czekają na towar</p>
                <p className="text-lg font-bold tabular-nums text-amber-800">{totalPending}</p>
              </div>
            </div>
          ) : null}
          {totalFollowUpDue > 0 ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-violet-200/70 bg-violet-50/50 px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700">
                <IconClipboardList size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-violet-900">Przypomnienia ZK</p>
                <p className="text-lg font-bold tabular-nums text-violet-800">{totalFollowUpDue}</p>
              </div>
            </div>
          ) : null}
          {totalNotesFollowUpDue > 0 ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-indigo-200/70 bg-indigo-50/50 px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-700">
                <IconNotebook size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-indigo-900">Przypomnienia notatek</p>
                <p className="text-lg font-bold tabular-nums text-indigo-800">{totalNotesFollowUpDue}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {sections.map((section) => {
        const title = section.group?.name ?? "Bez grupy";
        const key = section.group?.id ?? "unassigned";
        const sectionPending = section.rows.reduce((sum, row) => sum + row.pendingZkCount, 0);
        const sectionFollowUpDue = section.rows.reduce(
          (sum, row) => sum + row.followUpDueZkCount,
          0
        );

        return (
          <section key={key} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-100 pb-2.5 pt-0.5">
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200/60"
                  aria-hidden
                >
                  <IconUsers size={14} />
                </span>
                <h2 className={cn(salesTypography.sectionLabel, "normal-case tracking-normal text-slate-700")}>
                  {title}
                </h2>
                {sectionFollowUpDue > 0 ? (
                  <Badge variant="purple" className="text-[10px]">
                    {formatPrzypomnienieCount(sectionFollowUpDue)}
                  </Badge>
                ) : sectionPending > 0 ? (
                  <Badge variant="warning" className="text-[10px]">
                    {sectionPending} ZK na towar
                  </Badge>
                ) : null}
              </div>
              <span className={salesTypography.rowMeta}>
                {section.rows.length}{" "}
                {section.rows.length === 1 ? "osoba" : section.rows.length < 5 ? "osoby" : "osób"}
              </span>
            </div>
            {section.rows.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {section.rows.map((row) => (
                  <SalesPersonCard
                    key={row.id}
                    row={row}
                    isSelf={managerSalesPersonId === row.id}
                    prosbaReadOnly={prosbaReadOnly}
                  />
                ))}
              </div>
            ) : (
              <p className={salesTypography.sectionHint}>Brak handlowców w tej grupie.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
