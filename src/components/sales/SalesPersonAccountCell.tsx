import type { SalesPersonAdminRow } from "@/lib/data/sales-people-admin-shared";
import { formatPlDate } from "@/lib/display-labels";
import { Badge } from "@/components/ui/Badge";

function formatAccountDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return formatPlDate(iso.slice(0, 10)) ?? null;
}

/** Kolumna „Konto w systemie” — rozdziela utworzenie konta, aktywność i logowanie. */
export function SalesPersonAccountCell({
  row,
}: {
  row: Pick<
    SalesPersonAdminRow,
    | "linkedUserEmail"
    | "linkedUserCreatedAt"
    | "linkedUserLastSignInAt"
    | "linkedUserLastActivityAt"
  >;
}) {
  if (!row.linkedUserEmail) {
    return (
      <Badge variant="warning" className="text-[0.625rem]">
        Brak konta
      </Badge>
    );
  }

  const created = formatAccountDate(row.linkedUserCreatedAt);
  const activity = formatAccountDate(row.linkedUserLastActivityAt);
  const signIn = formatAccountDate(row.linkedUserLastSignInAt);
  const signInDiffers = Boolean(signIn && activity && signIn !== activity);

  return (
    <div className="space-y-1">
      <Badge variant="success" className="text-[0.625rem]">
        Ma konto
      </Badge>
      <p className="text-xs text-slate-600">{row.linkedUserEmail}</p>
      {created ? <p className="text-[0.6875rem] text-slate-400">Konto od: {created}</p> : null}
      {activity ? (
        <p className="text-[0.6875rem] text-slate-500">Ostatnia aktywność: {activity}</p>
      ) : signIn ? (
        <p className="text-[0.6875rem] text-slate-500">Ostatnie logowanie: {signIn}</p>
      ) : (
        <p className="text-[0.6875rem] text-amber-700">Brak zarejestrowanej aktywności</p>
      )}
      {signInDiffers ? (
        <p className="text-[0.6875rem] text-slate-400">Ostatnie logowanie: {signIn}</p>
      ) : null}
    </div>
  );
}
