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
  formatZdNameAutoExcludeLabel,
  type ZdNameAutoExcludeMatch,
} from "@/lib/orders/zd-estimate-name-exclude";
import type { ZdEstimatePairMeta } from "@/lib/orders/zd-estimate-pairs";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
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
  const role = pair.role === "pack" ? "Paczka" : "Sztuki";
  if (pair.partnerMissing) return `${role} · brak`;
  if (packagingConflict) return `${role} · konflikt`;
  return `${role} · ×${pair.unitsPerPack}`;
}

function bomSummary(bom: ZdEstimateBomMeta): string {
  if (bom.role === "assembled_parent") return "Skład · nie ZD";
  if (bom.role === "purchased_kit") {
    return bom.purchaseTarget === "kit_only"
      ? "Komplet · tylko kit"
      : "Komplet · kupowany";
  }
  if (bom.componentMissing) return "Skład · brak";
  if (bom.purchaseBlocked) return "Skład · blokada";
  const sales = bom.contributionSales ?? 0;
  if (sales > 0) return `Skład · +${formatQty(sales)}`;
  return "Skład · składnik";
}

function statusTone(
  kind: Exclude<ZdEstimateNameMetaKind, "individual" | "pair" | "bom">
): ZdEstimateStatusBadgeTone {
  if (
    kind === "excluded" ||
    kind === "name_auto_exclude" ||
    kind === "soft_on_request"
  ) {
    return "amber";
  }
  if (kind === "session_include") return "sky";
  if (kind === "lifted_extra_only") return "emerald";
  return "indigo";
}

function statusKindLabel(
  kind: Exclude<ZdEstimateNameMetaKind, "individual" | "pair" | "bom">
): string {
  if (kind === "excluded") return "Wykl.";
  if (kind === "name_auto_exclude") return "Auto";
  if (kind === "session_include") return "Sesja";
  if (kind === "soft_on_request") return "Na prośbę";
  if (kind === "lifted_extra_only") return "Z prośby";
  return "Status";
}

function statusMeta(
  kind: Exclude<ZdEstimateNameMetaKind, "individual" | "pair" | "bom">,
  nameHit?: ZdNameAutoExcludeMatch | null
): string | undefined {
  if (kind === "excluded") return undefined;
  if (kind === "name_auto_exclude" && nameHit) {
    return formatZdNameAutoExcludeLabel(nameHit.reason);
  }
  if (kind === "session_include") return "włącz";
  if (kind === "soft_on_request") return undefined;
  if (kind === "lifted_extra_only") return "w Do ZD";
  return undefined;
}

function statusSummary(
  kind: Exclude<ZdEstimateNameMetaKind, "individual" | "pair" | "bom">,
  nameHit?: ZdNameAutoExcludeMatch | null
): string {
  const label = statusKindLabel(kind);
  const meta = statusMeta(kind, nameHit);
  return meta ? `${label} · ${meta}` : label;
}

function individualSummary(
  extra: ZdEstimateIndividualTwExtra,
  extrasPolicy: "sum" | "max",
  doZdSuppressed: boolean
): string {
  if (doZdSuppressed) return "Prośba · poza Do ZD";
  if (extrasPolicy === "max") return "Prośba · max";
  return `Prośba · ${formatQty(extra.extraPieces)} szt`;
}

/**
 * Kolumna Status: do {@link ZD_ESTIMATE_STATUS_VISIBLE_MAX} chipów wg priorytetu;
 * nadmiar jako +N (tooltip z listą).
 */
export const ZD_ESTIMATE_STATUS_VISIBLE_MAX = 4;

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
      summary: individualSummary(
        individualExtra,
        extrasPolicy,
        doZdSuppressed
      ),
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
    const kind = status.kind as Exclude<
      ZdEstimateNameMetaKind,
      "individual" | "pair" | "bom"
    >;
    const title =
      status.kind === "name_auto_exclude" && nameHit
        ? formatZdNameAutoExcludeBadge(nameHit.reason)
        : status.summary;
    items.push({
      kind: status.kind,
      summary: statusSummary(kind, nameHit),
      node: (
        <ZdEstimateStatusBadge
          kind={statusKindLabel(kind)}
          meta={statusMeta(kind, nameHit)}
          tone={statusTone(kind)}
          title={title}
        />
      ),
    });
  }

  if (items.length === 0) {
    return (
      <div className="zd-est-status" title="Brak oznaczeń statusu">
        <span className="zd-est-status-empty" aria-hidden>
          —
        </span>
      </div>
    );
  }

  const ordered = sortZdEstimateNameMetaCandidates(items);
  const visible = ordered.slice(0, ZD_ESTIMATE_STATUS_VISIBLE_MAX);
  const overflow = ordered.slice(ZD_ESTIMATE_STATUS_VISIBLE_MAX);
  const overflowTitle = buildZdEstimateNameMetaOverflowTitle(overflow);

  return (
    <div className="zd-est-status">
      {visible.map((item) => (
        <div key={item.kind} className="zd-est-status__chip">
          {item.node}
        </div>
      ))}
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
