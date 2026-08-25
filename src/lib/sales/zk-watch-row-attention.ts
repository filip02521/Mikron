import {
  type ZkWatchRowAccentKind,
  type ZkWatchRowRailKind,
} from "@/lib/ui/zk-watch-attention-styles";

export type ZkWatchRowAttentionKind =
  | "regal_new"
  | "follow_up_due"
  | "regal_waiting"
  | "informacja_ready"
  | "new_lines"
  | "newly_added"
  | "ready_to_close"
  | "scope_overflow";

export type ZkWatchRowAttentionInput = {
  archived?: boolean;
  hasNewWarehouseArrival: boolean;
  followUpDue: boolean;
  followUpLabel?: string | null;
  regalWaitingCount: number;
  hasRegalWaiting: boolean;
  hasInformacjaReady: boolean;
  hasNewZkLines: boolean;
  isNewlyAdded: boolean;
  readyToClose: boolean;
  hiddenOutsideScope: number;
};

export type ZkWatchRowAttention = {
  kind: ZkWatchRowAttentionKind;
  label: string;
  title: string;
};

export type ZkWatchRowChrome = {
  isAction: boolean;
  isUrgent: boolean;
  /** Wiersz z szerokim rail-em (regal / gotowe do zamknięcia). */
  railKind?: ZkWatchRowRailKind;
  /** Wiersz z cienkim akcentem (informacja, nowe pozycje, przypomnienie…). */
  accentKind?: ZkWatchRowAccentKind;
};

const PRIORITY: ZkWatchRowAttentionKind[] = [
  "regal_new",
  "regal_waiting",
  "follow_up_due",
  "informacja_ready",
  "new_lines",
  "newly_added",
  "ready_to_close",
  "scope_overflow",
];

function regalWaitingLabel(count: number): Pick<ZkWatchRowAttention, "label" | "title"> {
  const label =
    count === 1 ? "Czeka na odbiór" : `Czeka na odbiór (${count})`;
  const title = `${count} ${count === 1 ? "pozycja czeka" : "pozycje czekają"} na odbiór z regału — Moje zamówienia`;
  return { label, title };
}

function isReadyToCloseEligible(input: ZkWatchRowAttentionInput): boolean {
  return (
    !input.archived &&
    input.readyToClose &&
    !input.hasRegalWaiting &&
    !input.hasNewWarehouseArrival
  );
}

function followUpDueAttention(input: ZkWatchRowAttentionInput): ZkWatchRowAttention {
  return {
    kind: "follow_up_due",
    label: input.followUpLabel ? `Przypomnienie · ${input.followUpLabel}` : "Przypomnienie",
    title: input.followUpLabel
      ? `Termin przypomnienia minął (${input.followUpLabel}) — ustaw nowy termin lub zamknij sprawę`
      : "Termin przypomnienia minął",
  };
}

function attentionForKind(
  kind: ZkWatchRowAttentionKind,
  input: ZkWatchRowAttentionInput
): ZkWatchRowAttention | null {
  switch (kind) {
    case "regal_new":
      if (!input.hasNewWarehouseArrival || input.archived) return null;
      return {
        kind,
        label: "Nowy na regale",
        title: "Nowy towar czeka na odbiór z regału — potwierdź w Moje zamówienia",
      };
    case "regal_waiting":
      if (
        input.archived ||
        input.hasNewWarehouseArrival ||
        !input.hasRegalWaiting
      ) {
        return null;
      }
      return {
        kind,
        ...regalWaitingLabel(input.regalWaitingCount),
      };
    case "follow_up_due":
      if (input.archived || !input.followUpDue || isReadyToCloseEligible(input)) {
        return null;
      }
      return followUpDueAttention(input);
    case "informacja_ready":
      if (
        input.archived ||
        input.hasRegalWaiting ||
        input.hasNewWarehouseArrival ||
        !input.hasInformacjaReady
      ) {
        return null;
      }
      return {
        kind,
        label: "Dostępne",
        title: "Magazyn potwierdził dostępność — prośba informacyjna",
      };
    case "new_lines":
      if (input.archived || !input.hasNewZkLines) return null;
      return {
        kind,
        label: "Nowe pozycje",
        title: "Nowe pozycje w ZK od ostatniego odświeżenia",
      };
    case "newly_added":
      if (input.archived || !input.isNewlyAdded) return null;
      return {
        kind,
        label: "Nowe ZK",
        title: "ZK dopiero co dodane na listę",
      };
    case "ready_to_close":
      if (
        input.archived ||
        !input.readyToClose ||
        input.hasRegalWaiting ||
        input.hasNewWarehouseArrival
      ) {
        return null;
      }
      return {
        kind,
        label: "Do zamknięcia",
        title: "Wszystkie pozycje odhaczone — możesz zamknąć sprawę ZK",
      };
    case "scope_overflow":
      if (input.archived || input.hiddenOutsideScope <= 0) return null;
      return {
        kind,
        label: `+${input.hiddenOutsideScope} poz. ZK`,
        title: `${input.hiddenOutsideScope} poz. spoza wybranego zakresu — pełną listę zobaczysz w podglądzie ZK`,
      };
    default:
      return null;
  }
}

export function deriveZkWatchRowAttention(
  input: ZkWatchRowAttentionInput
): ZkWatchRowAttention | null {
  if (input.archived) return null;
  for (const kind of PRIORITY) {
    const attention = attentionForKind(kind, input);
    if (attention) return attention;
  }
  return null;
}

/** Drugi badge — przypomnienie obok primary (np. gotowe do zamknięcia + termin minął). */
export function deriveZkWatchFollowUpDueBadge(
  input: ZkWatchRowAttentionInput
): ZkWatchRowAttention | null {
  if (input.archived || !input.followUpDue) return null;
  const primary = deriveZkWatchRowAttention(input);
  if (primary?.kind === "follow_up_due") return null;
  return followUpDueAttention(input);
}

function kindRank(kind: ZkWatchRowAttentionKind): number {
  const index = PRIORITY.indexOf(kind);
  return index === -1 ? PRIORITY.length : index;
}

export function deriveZkWatchRowSecondaryMeta(input: ZkWatchRowAttentionInput): string[] {
  if (input.archived) return [];

  const primary = deriveZkWatchRowAttention(input);
  const parts: string[] = [];

  if (
    input.followUpDue &&
    input.followUpLabel &&
    primary?.kind !== "follow_up_due" &&
    primary?.kind !== "ready_to_close"
  ) {
    parts.push(`Przypomnienie: ${input.followUpLabel}`);
  }

  const candidates: Array<{ kind: ZkWatchRowAttentionKind; fragment: string }> = [];

  if (input.hasRegalWaiting && !input.hasNewWarehouseArrival) {
    const { label } = regalWaitingLabel(input.regalWaitingCount);
    candidates.push({ kind: "regal_waiting", fragment: label });
  }
  if (input.hasInformacjaReady && !input.hasRegalWaiting) {
    candidates.push({ kind: "informacja_ready", fragment: "Dostępne (informacja)" });
  }
  if (input.hasNewZkLines) {
    candidates.push({ kind: "new_lines", fragment: "Nowe pozycje" });
  }
  if (input.isNewlyAdded) {
    candidates.push({ kind: "newly_added", fragment: "Nowe ZK" });
  }
  if (
    input.readyToClose &&
    !input.hasRegalWaiting &&
    !input.hasNewWarehouseArrival
  ) {
    candidates.push({ kind: "ready_to_close", fragment: "Do zamknięcia" });
  }
  if (input.hiddenOutsideScope > 0) {
    candidates.push({
      kind: "scope_overflow",
      fragment: `+${input.hiddenOutsideScope} poz. spoza zakresu`,
    });
  }

  for (const candidate of candidates) {
    if (!primary || kindRank(candidate.kind) > kindRank(primary.kind)) {
      parts.push(candidate.fragment);
    }
  }

  return parts;
}

export function deriveZkWatchRowChrome(input: ZkWatchRowAttentionInput): ZkWatchRowChrome {
  if (input.archived) {
    return { isAction: false, isUrgent: false };
  }

  const primary = deriveZkWatchRowAttention(input);
  const isUrgent = input.followUpDue && primary?.kind !== "ready_to_close";
  const isAction =
    input.readyToClose &&
    !input.hasRegalWaiting &&
    !input.hasNewWarehouseArrival;

  if (isAction && primary?.kind === "ready_to_close") {
    return { isAction: true, isUrgent, railKind: "ready_to_close" };
  }

  switch (primary?.kind) {
    case "regal_new":
      return {
        isAction: false,
        isUrgent,
        railKind: "regal_new",
      };

    case "regal_waiting":
      return {
        isAction: false,
        isUrgent,
        railKind: "regal_waiting",
      };
    case "follow_up_due":
      return {
        isAction: false,
        isUrgent: true,
        accentKind: "follow_up",
      };
    case "informacja_ready":
      return {
        isAction: false,
        isUrgent,
        accentKind: "informacja",
      };
    case "new_lines":
      return {
        isAction: false,
        isUrgent,
        accentKind: "new_lines",
      };
    case "newly_added":
      return {
        isAction: false,
        isUrgent,
        accentKind: "newly_added",
      };
    case "ready_to_close":
      return { isAction: true, isUrgent, railKind: "ready_to_close" };
    case "scope_overflow":
      return {
        isAction: false,
        isUrgent,
        accentKind: "scope_overflow",
      };
    default:
      return { isAction: false, isUrgent };
  }
}

const LINE_SUMMARY_REGAL = /^(\d+|1) na regale$/;
const LINE_SUMMARY_DOSTEPNE = /^(\d+|1) dostępne$/;
const LINE_SUMMARY_NOWE = /^(\d+|1) nowe?$/;

function filterLineStatusSummaryForPrimary(
  lineStatusSummary: string | null,
  primary: ZkWatchRowAttention | null
): string | null {
  if (!lineStatusSummary?.trim()) return null;
  if (!primary) return lineStatusSummary;

  const segments = lineStatusSummary.split(" · ").filter(Boolean);
  const filtered = segments.filter((segment) => {
    switch (primary.kind) {
      case "regal_new":
      case "regal_waiting":
        return !LINE_SUMMARY_REGAL.test(segment);
      case "informacja_ready":
        return !LINE_SUMMARY_DOSTEPNE.test(segment);
      case "new_lines":
        return !LINE_SUMMARY_NOWE.test(segment);
      default:
        return true;
    }
  });

  return filtered.length ? filtered.join(" · ") : null;
}

export function buildZkWatchCardMetaSummary(parts: {
  prosbaScopeSummary: string | null;
  prosbaRowMeta: string | null;
  lineStatusSummary: string | null;
  secondaryMeta: string[];
  primaryAttention: ZkWatchRowAttention | null;
}): string | null {
  const lineSummary = filterLineStatusSummaryForPrimary(
    parts.lineStatusSummary,
    parts.primaryAttention
  );

  const segments = [
    parts.prosbaScopeSummary,
    parts.prosbaRowMeta,
    lineSummary,
    ...parts.secondaryMeta,
  ].filter((segment): segment is string => Boolean(segment?.trim()));

  return segments.length ? segments.join(" · ") : null;
}
