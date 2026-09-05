import { parseDateOnly } from "@/lib/orders/dates";
import { warsawDateKeyFromIso } from "@/lib/time/warsaw";

/** Data kalendarzowa w Warszawie z ISO lub YYYY-MM-DD (Vercel = UTC). */
export function teethPlacementDateOnly(placementAt: string): Date | null {
  const raw = placementAt.trim();
  if (!raw) return null;
  const key = raw.length === 10 ? raw : warsawDateKeyFromIso(raw);
  return parseDateOnly(key);
}
