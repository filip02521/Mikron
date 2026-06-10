import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";

import { buildNotatnikPageHref } from "@/lib/sales/notepad-page-tabs";

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
  return buildNotatnikPageHref({
    tab: "zk",
    focusWatch: options.zkWatchId,
    salesPersonId: options.salesPersonId,
    preview: options.preview,
  });
}
