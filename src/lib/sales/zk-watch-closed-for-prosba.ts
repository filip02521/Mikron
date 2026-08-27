import { isZkWatchArchived } from "@/lib/data/sales-notepad";
import type { SalesZkWatch } from "@/types/database";

export const ZK_WATCH_CLOSED_FOR_PROSBA_MESSAGE =
  "Nie można tworzyć prośby dla zamkniętego lub zarchiwizowanego ZK.";

export function assertZkWatchOpenForProsba(
  watch: Pick<SalesZkWatch, "closed_at" | "archived_at">
): void {
  if (isZkWatchArchived(watch)) {
    throw new Error(ZK_WATCH_CLOSED_FOR_PROSBA_MESSAGE);
  }
}

/** Prefill: null gdy zamknięte (caller pokazuje warning). */
export function nullIfZkWatchClosedForProsba<
  T extends Pick<SalesZkWatch, "closed_at" | "archived_at">,
>(watch: T | null | undefined): T | null {
  if (!watch) return null;
  if (isZkWatchArchived(watch)) return null;
  return watch;
}
