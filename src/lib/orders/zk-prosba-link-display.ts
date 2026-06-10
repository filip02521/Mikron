import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";

/** Numer ZK bez prefiksu — do etykiet typu „ZK 153157/M/04/2026”. */
export function formatProsbaZkLinkNumber(zkNumber: string | null | undefined): string {
  const raw = zkNumber?.trim();
  if (!raw) return "";
  return formatZkWatchDisplayNumber(raw);
}

export function buildNotatnikZkWatchHref(options: {
  zkWatchId: string;
  salesPersonId?: string;
  preview?: boolean;
}): string {
  const watchId = options.zkWatchId.trim();
  const params = new URLSearchParams();
  if (options.preview && options.salesPersonId?.trim()) {
    params.set("dla", options.salesPersonId.trim());
  }
  params.set("focusWatch", watchId);
  return `/notatnik?${params.toString()}#watch-${watchId}`;
}
