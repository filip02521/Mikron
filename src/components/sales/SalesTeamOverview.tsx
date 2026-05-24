"use client";

import Link from "next/link";
import type { SalesPersonAdminRow } from "@/lib/data/sales-people-admin";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export function SalesTeamOverview({
  rows,
  managerSalesPersonId,
}: {
  rows: SalesPersonAdminRow[];
  managerSalesPersonId: string | null;
}) {
  if (!rows.length) {
    return (
      <EmptyState
        title="Brak handlowców"
        description="Dodaj pierwszą osobę w sekcji Handlowcy i konta."
        action={
          <Link href="/zespol/handlowcy">
            <Button>Dodaj handlowca</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => {
        const isSelf = managerSalesPersonId === row.id;
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
                ) : null
              }
            />
            <div className="space-y-3 px-4 pb-4 sm:px-5">
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">Zamówienia</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {row.orderCount}
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
                    {isSelf ? "Mój panel" : "Podgląd panelu"}
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
      })}
    </div>
  );
}
