// @service-role-ok — autoryzacja requireSubiektLookup() + zakres handlowca jak przy wysyłce prośby.
// Route handler, nie Server Action: akcje idą po kolei na klienta, a to sprawdzenie (do 4 s)
// blokowałoby wyszukiwarkę towarów, ustalanie dostawcy i wysyłkę.

import { NextResponse } from "next/server";
import { requireSubiektLookup, type SessionUser } from "@/lib/auth";
import {
  canAccessOperations,
  canAccessTeethPanel,
  isAdmin,
  isSales,
  isSalesManager,
} from "@/lib/auth-roles";
import { loadProsbaAlreadyOrdered } from "@/lib/orders/prosba-already-ordered-load";
import {
  PROSBA_ALREADY_ORDERED_MAX_TW_IDS,
  type ProsbaAlreadyOrderedMap,
} from "@/lib/orders/prosba-already-ordered";

/**
 * Czyje otwarte prośby sprawdzamy (dubel) — te same zasady co przy wysyłce prośby:
 * handlowiec tylko swoje; kierownik — siebie i osoby z przypisanych grup; zakupy / zęby /
 * admin — dowolnego handlowca. Inny wybór = brak sprawdzania dubla (nie cudze dane).
 */
async function resolveOwnSalesPersonId(
  user: SessionUser,
  requested: string | null
): Promise<string | null> {
  if (isSales(user.role)) {
    const { resolveSalesPersonForUser } = await import("@/lib/auth/sales-person");
    return (await resolveSalesPersonForUser(user))?.id ?? null;
  }
  if (!requested) return user.salesPersonId;
  if (requested === user.salesPersonId) return requested;
  if (
    isAdmin(user.role) ||
    canAccessOperations(user.role, user.assignedWorkspaces) ||
    canAccessTeethPanel(user.role, user.assignedWorkspaces)
  ) {
    return requested;
  }
  if (isSalesManager(user.role)) {
    const { canAccessSalesPerson } = await import("@/lib/data/sales-group-access");
    return (await canAccessSalesPerson(user, requested)) ? requested : null;
  }
  return null;
}

/**
 * Formularz prośby: czy towar jest w drodze i wolny (Subiekt na żywo) i czy ten handlowiec
 * nie ma już otwartej prośby na ten towar. Te same role co podpowiedź stanu Subiekta.
 */
export async function POST(request: Request) {
  let user: SessionUser;
  try {
    user = await requireSubiektLookup();
  } catch {
    return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    twIds?: unknown;
    /** Prośba składana w imieniu tego handlowca (zakupy, kierownik, „dla”). */
    forSalesPersonId?: unknown;
  } | null;
  const twIds: unknown[] = Array.isArray(body?.twIds) ? body.twIds : [];
  const ids = twIds
    .filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n > 0 && n < 2_147_483_647)
    .slice(0, PROSBA_ALREADY_ORDERED_MAX_TW_IDS);
  const forSalesPersonId = body?.forSalesPersonId;
  const requested =
    typeof forSalesPersonId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(forSalesPersonId.trim())
      ? forSalesPersonId.trim()
      : null;
  const own = await resolveOwnSalesPersonId(user, requested);
  const map: ProsbaAlreadyOrderedMap = await loadProsbaAlreadyOrdered(ids, own);
  return NextResponse.json(map);
}
