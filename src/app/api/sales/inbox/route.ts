import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isSalesAccount } from "@/lib/auth-roles";
import { fetchSalesInboxSnapshot } from "@/lib/sales/fetch-sales-inbox";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isSalesAccount(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const salesPerson = await resolveSalesPersonForUser(user);
  if (!salesPerson) {
    return NextResponse.json({ error: "Brak powiązanego handlowca" }, { status: 403 });
  }

  try {
    const snapshot = await fetchSalesInboxSnapshot(salesPerson.id, user.id);
    return NextResponse.json(snapshot);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nie udało się załadować inboxu.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
