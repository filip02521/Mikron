import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { computeSalesActivityVersion } from "@/lib/orders/sales-activity-version";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "sales") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const salesPerson = await resolveSalesPersonForUser(user);
  if (!salesPerson) {
    return NextResponse.json({ error: "Brak powiązanego handlowca" }, { status: 403 });
  }

  const version = await computeSalesActivityVersion(salesPerson.id);
  return NextResponse.json({ version });
}
