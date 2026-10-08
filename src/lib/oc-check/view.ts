import type { OcCheck } from "./types";

export const OC_VIEWS = ["do-ruchu", "zgodne", "wyjasnione"] as const;
export type OcView = (typeof OC_VIEWS)[number];

export function parseOcView(value: string | string[] | undefined): OcView {
  const v = Array.isArray(value) ? value[0] : value;
  return OC_VIEWS.includes(v as OcView) ? (v as OcView) : "do-ruchu";
}

/** Zgodne OC bez decyzji to informacja, nie zadanie — nie zaśmiecają „Do ruchu”. */
export function ocCheckView(check: Pick<OcCheck, "status" | "resolvedAt">): OcView {
  if (check.resolvedAt) return "wyjasnione";
  return check.status === "zgodne" ? "zgodne" : "do-ruchu";
}

function receivedMs(check: Pick<OcCheck, "ocReceivedAt">): number {
  return check.ocReceivedAt ? new Date(check.ocReceivedAt).getTime() : 0;
}

export function groupOcChecks(checks: OcCheck[]): Record<OcView, OcCheck[]> {
  const groups: Record<OcView, OcCheck[]> = { "do-ruchu": [], zgodne: [], wyjasnione: [] };
  for (const check of checks) groups[ocCheckView(check)].push(check);
  groups["do-ruchu"].sort((a, b) => b.priority - a.priority || receivedMs(b) - receivedMs(a));
  groups.zgodne.sort((a, b) => receivedMs(b) - receivedMs(a));
  groups.wyjasnione.sort(
    (a, b) => new Date(b.resolvedAt ?? 0).getTime() - new Date(a.resolvedAt ?? 0).getTime()
  );
  return groups;
}

/** Link do wątku w Gmailu: thread-f to dziesiętny zapis szesnastkowego id wątku. */
export function gmailThreadUrl(mailbox: string, threadId: string | null): string | null {
  if (!threadId || !/^[0-9a-f]{10,24}$/i.test(threadId)) return null;
  const params = mailbox ? `?authuser=${encodeURIComponent(mailbox)}` : "";
  return `https://mail.google.com/mail/${params}#all/thread-f:${BigInt(`0x${threadId}`).toString(10)}`;
}
