"use client";

import type { ReactNode } from "react";
import type { ZdEstimateBomMeta } from "@/lib/orders/zd-estimate-bom";
import type { ZdEstimateIndividualTwExtra } from "@/lib/orders/zd-estimate-individual";
import {
  buildZdEstimateNameMetaOverflowTitle,
  resolveZdEstimateNameMetaStatus,
  sortZdEstimateNameMetaCandidates,
  type ZdEstimateNameMetaCandidate,
  type ZdEstimateNameMetaKind,
} from "@/lib/orders/zd-estimate-name-meta-priority";
import {
  formatZdNameAutoExcludeBadge,
  type ZdNameAutoExcludeMatch,
} from "@/lib/orders/zd-estimate-name-exclude";
import type { ZdEstimatePairMeta } from "@/lib/orders/zd-estimate-pairs";
import { ZdEstimateBomMetaBadge } from "@/components/zakupy/ZdEstimateBomMetaBadge";
import { ZdEstimateIndividualMetaBadge } from "@/components/zakupy/ZdEstimateIndividualMetaBadge";
import { ZdEstimatePairMetaBadge } from "@/components/zakupy/ZdEstimatePairMetaBadge";
import {
  ZdEstimateStatusBadge,
  type ZdEstimateStatusBadgeTone,
} from "@/components/zakupy/ZdEstimateStatusBadge";

type StackItem = ZdEstimateNameMetaCandidate & {
  node: ReactNode;
};

function pairSummary(
  pair: ZdEstimatePairMeta,
  packagingConflict?: boolean
): string {
  const role = pair.role === "pack" ? "Paczka · na ZD" : "Sztuki · nie na ZD";
  if (pair.partnerMissing) return `${role} · brak partnera`;
  if (packagingConflict) return `${role} · konflikt opak.`;
  return role;
}

function bomSummary(bom: ZdEstimateBomMeta): string {
  if (bom.role === "assembled_parent") return "Skład · zestaw";
  if (bom.role === "purchased_kit") {
    return bom.purchaseTarget === "kit_only"
      ? "Komplet · tylko kit"
      : "Komplet";
  }
  if (bom.componentMissing) return "Skład · brak składnika";
  if (bom.purchaseBlocked) return "Skład · blokada zakupu";
  return "Skład · składnik";
}

function statusTone(
  kind: Exclude<ZdEstimateNameMetaKind, "individual" | "pair" | "bom">
): ZdEstimateStatusBadgeTone {
  if (kind === "excluded" || kind === "name_auto_exclude") return "amber";
  if (kind === "session_include") return "sky";
  if (kind === "lifted_extra_only") return "emerald";
  return "indigo";
}

function statusKindLabel(
  kind: Exclude<ZdEstimateNameMetaKind, "individual" | "pair" | "bom">
): string {
  if (kind === "excluded") return "Wyklucz.";
  if (kind === "name_auto_exclude") return "Auto";
  if (kind === "session_include") return "Sesja";
  if (kind === "soft_on_request") return "Na prośbę";
  if (kind === "lifted_extra_only") return "Prośba";
  return "Status";
}

function statusMeta(
  kind: Exclude<ZdEstimateNameMetaKind, "individual" | "pair" | "bom">,
  label: string
): string | undefined {
  if (kind === "excluded") return undefined;
  if (kind === "name_auto_exclude") {
    return label.replace(/^auto\s*·\s*/i, "");
  }
  if (kind === "session_include") return "dołączone";
  if (kind === "soft_on_request") return "poza Do ZD";
  if (kind === "lifted_extra_only") return "w Do ZD";
  return label;
}

/**
 * Kolumna Status: max 1 primary badge + „+N” overflow.
 */
export function ZdEstimateNameMetaStack({
  pairMeta,
  packagingConflict,
  bomMeta,
  individualExtra,
  extrasPolicy = "sum",
  doZdSuppressed = false,
  excluded,
  sessionIncluded,
  nameHit,
  softOnRequest,
  liftedExtraOnly,
}: {
  pairMeta?: ZdEstimatePairMeta | null;
  packagingConflict?: boolean;
  bomMeta?: ZdEstimateBomMeta | null;
  individualExtra?: ZdEstimateIndividualTwExtra | null;
  extrasPolicy?: "sum" | "max";
  doZdSuppressed?: boolean;
  excluded: boolean;
  sessionIncluded: boolean;
  nameHit?: ZdNameAutoExcludeMatch | null;
  softOnRequest: boolean;
  liftedExtraOnly: boolean;
}) {
  const items: StackItem[] = [];

  if (individualExtra) {
    items.push({
      kind: "individual",
      summary: doZdSuppressed
        ? "Prośba · nie w Do ZD"
        : `Prośba · ${individualExtra.extraPieces} szt`,
      node: (
        <ZdEstimateIndividualMetaBadge
          extra={individualExtra}
          extrasPolicy={extrasPolicy}
          doZdSuppressed={doZdSuppressed}
        />
      ),
    });
  }

  if (pairMeta) {
    items.push({
      kind: "pair",
      summary: pairSummary(pairMeta, packagingConflict),
      node: (
        <ZdEstimatePairMetaBadge
          pair={pairMeta}
          packagingConflict={packagingConflict}
        />
      ),
    });
  }

  if (bomMeta) {
    items.push({
      kind: "bom",
      summary: bomSummary(bomMeta),
      node: <ZdEstimateBomMetaBadge bom={bomMeta} />,
    });
  }

  const status = resolveZdEstimateNameMetaStatus({
    excluded,
    sessionIncluded,
    hasNameAutoExclude: Boolean(nameHit),
    softOnRequest,
    liftedExtraOnly,
  });

  if (status) {
    const label =
      status.kind === "name_auto_exclude" && nameHit
        ? formatZdNameAutoExcludeBadge(nameHit.reason)
        : status.summary;
    const kind = status.kind as Exclude<
      ZdEstimateNameMetaKind,
      "individual" | "pair" | "bom"
    >;
    items.push({
      kind: status.kind,
      summary: label,
      node: (
        <ZdEstimateStatusBadge
          kind={statusKindLabel(kind)}
          meta={statusMeta(kind, label)}
          tone={statusTone(kind)}
          title={label}
        />
      ),
    });
  }

  if (items.length === 0) return null;

  const ordered = sortZdEstimateNameMetaCandidates(items);
  const [primary, ...overflow] = ordered;
  const overflowTitle = buildZdEstimateNameMetaOverflowTitle(overflow);

  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className="min-w-0 max-w-full overflow-hidden">{primary.node}</div>
      {overflow.length > 0 ? (
        <span
          className="zd-est-status-more"
          title={overflowTitle}
          aria-label={overflowTitle.replace(/\n/g, ", ")}
        >
          +{overflow.length}
        </span>
      ) : null}
    </div>
  );
}
