"use client";

import Link from "next/link";
import type { SalesPersonAdminRow } from "@/lib/data/sales-people-admin";
import type { SalesGroupRow } from "@/lib/data/sales-groups";
import type { SalesTeamUiContext } from "@/lib/sales/team-ui";
import { groupSalesPeopleForTeamView } from "@/lib/sales/team-grouping";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

function SalesPersonCard({
  row,
  isSelf,
}: {
  row: SalesPersonAdminRow;
  isSelf: boolean;
}) {
  return (
    <Card key={row.id} padding={false} className={isSelf ? "ring-1 ring-indigo-200" : ""}>
      <CardHeader
        inset
        title={row.name}
        description={row.email}
        action={
          isSelf ? (
            <Badge variant="info" className="text-[10px]">
              Ty
            </Badge>
          ) : row.groupName ? (
            <Badge variant="default" className="text-[10px]">
              {row.groupName}
            </Badge>
          ) : null
        }
      />
      <div className="space-y-3 px-4 pb-4 sm:px-5">
        <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Zamówienia</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{row.orderCount}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Czeka na towar</dt>
            <dd className="font-semibold tabular-nums text-slate-900">
              {row.pendingZkCount > 0 ? (
                <Link
                  href={`/notatnik?dla=${row.id}`}
                  className="text-amber-800 underline decoration-amber-300 underline-offset-2 hover:text-amber-950"
                >
                  {row.pendingZkCount}
                </Link>
              ) : (
                row.pendingZkCount
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Przypomnienia</dt>
            <dd className="font-semibold tabular-nums text-slate-900">
              {row.followUpDueZkCount > 0 ? (
                <Link
                  href={`/notatnik?dla=${row.id}`}
                  className="text-violet-800 underline decoration-violet-200 underline-offset-2 hover:text-violet-950"
                >
                  {row.followUpDueZkCount}
                </Link>
              ) : (
                row.followUpDueZkCount
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Konto</dt>
            <dd className="font-medium text-slate-800">
              {row.linkedUserEmail ? "Aktywne" : "Brak logowania"}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Link href={`/moje?dla=${row.id}`}>
            <Button size="sm" variant={isSelf ? "primary" : "secondary"}>
              {isSelf ? "Moje zamówienia" : "Zobacz prośby"}
            </Button>
          </Link>
          <Link href={`/notatnik?dla=${row.id}`}>
            <Button size="sm" variant="outline">
              Notatnik
            </Button>
          </Link>
          {!isSelf ? (
            <Link href={`/prosba?dla=${row.id}`}>
              <Button size="sm" variant="outline">
                Prośba w jego imieniu
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function SalesTeamOverview({
  rows,
  groups,
  managerSalesPersonId,
  teamUi,
}: {
  rows: SalesPersonAdminRow[];
  groups: SalesGroupRow[];
  managerSalesPersonId: string | null;
  teamUi?: SalesTeamUiContext;
}) {
  if (!rows.length) {
    const emptyDescription = teamUi?.isManager
      ? teamUi.hasTeamScope
        ? `Dodaj pierwszą osobę w sekcji Handlowcy i konta i przypisz do grupy (${teamUi.groupNamesLabel}).`
        : "Po przypisaniu grup przez administratora dodasz tu handlowców."
      : "Dodaj pierwszą osobę w sekcji Handlowcy i konta oraz przypisz grupę (Sklep / Biuro).";

    return (
      <EmptyState
        title="Brak handlowców"
        description={emptyDescription}
        action={
          teamUi?.isManager && !teamUi.hasTeamScope ? undefined : (
            <Link href="/zespol/handlowcy">
              <Button>Dodaj handlowca</Button>
            </Link>
          )
        }
      />
    );
  }

  const sections = groupSalesPeopleForTeamView(rows, groups);
  const totalFollowUpDue = rows.reduce((sum, row) => sum + row.followUpDueZkCount, 0);
  const totalPending = rows.reduce((sum, row) => sum + row.pendingZkCount, 0);

  return (
    <div className="space-y-8">
      {totalPending > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
          <span className="font-medium">
            Zespół: {totalPending} {totalPending === 1 ? "ZK czeka" : "ZK czeka"} na towar
          </span>
          {totalFollowUpDue > 0 ? (
            <Badge variant="purple" className="text-[10px]">
              {totalFollowUpDue} przypomnienie{totalFollowUpDue === 1 ? "" : totalFollowUpDue < 5 ? "a" : "ń"}
            </Badge>
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  {title}
                </h2>
                {sectionFollowUpDue > 0 ? (
                  <Badge variant="purple" className="text-[10px]">
                    {sectionFollowUpDue} przypomnienie
                    {sectionFollowUpDue === 1 ? "" : sectionFollowUpDue < 5 ? "a" : "ń"}
                  </Badge>
                ) : sectionPending > 0 ? (
                  <Badge variant="warning" className="text-[10px]">
                    {sectionPending} ZK na towar
                  </Badge>
                ) : null}
              </div>
              <span className="text-xs text-slate-500">
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
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Brak handlowców w tej grupie.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
