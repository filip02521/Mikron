"use client";

import { cn } from "@/lib/cn";
import { brandLinkSubtleClass, salesTypography } from "@/lib/ui/ontime-theme";
import {
  formatPln,
  formatShortDate,
  zkWatchSubtitle,
} from "@/lib/sales/notepad-format";
import {
  extractZkWatchClientContact,
  normalizePhoneHref,
} from "@/lib/sales/zk-watch-contact";
import type { SalesZkWatch } from "@/types/database";
import { ZK_MODAL_SECTION_HINTS, ZK_MODAL_SECTION_TITLES } from "@/lib/sales/zk-modal-section-copy";
import { ZkWatchModalSection } from "./ZkWatchModalSection";

function MetaFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className={salesTypography.sectionLabel}>{label}</p>
      <div className={cn("mt-0.5", salesTypography.rowBody, "text-slate-800")}>{children}</div>
    </div>
  );
}

export function ZkWatchLinesMetaSection({
  watch,
  readOnly,
  tourPreview = false,
  archived,
  showSubiektRealizedCloseHint = false,
}: {
  watch: SalesZkWatch;
  readOnly?: boolean;
  tourPreview?: boolean;
  archived?: boolean;
  showSubiektRealizedCloseHint?: boolean;
}) {
  const canEdit = !readOnly && !tourPreview && !archived;
  const clientContact = extractZkWatchClientContact(watch);
  const issued = formatShortDate(watch.zk_issued_at);
  const subtitle = zkWatchSubtitle(watch, { omitLineSummary: true });

  const hasContact = Boolean(clientContact.phone || clientContact.email);
  const hasFacts = hasContact || issued || watch.amount_gross != null || Boolean(subtitle);

  return (
    <ZkWatchModalSection title={ZK_MODAL_SECTION_TITLES.details} hint={ZK_MODAL_SECTION_HINTS.details}>
      {hasFacts ? (
        <div className="rounded-md border border-slate-200/90 bg-slate-50/50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {clientContact.phone ? (
              <MetaFact label="Telefon">
                <a href={normalizePhoneHref(clientContact.phone)} className={brandLinkSubtleClass}>
                  {clientContact.phone}
                </a>
              </MetaFact>
            ) : null}
            {clientContact.email ? (
              <MetaFact label="E-mail">
                <a href={`mailto:${clientContact.email}`} className={brandLinkSubtleClass}>
                  {clientContact.email}
                </a>
              </MetaFact>
            ) : null}
            {issued ? <MetaFact label="Wystawiono">{issued}</MetaFact> : null}
            {watch.amount_gross != null ? (
              <MetaFact label="Kwota">{formatPln(watch.amount_gross)}</MetaFact>
            ) : null}
          </div>
          {subtitle ? (
            <p className={cn("mt-2 border-t border-slate-200/70 pt-2", salesTypography.rowMeta)}>
              {subtitle}
            </p>
          ) : null}
          {archived && watch.closed_at ? (
            <p className={cn("mt-2", salesTypography.rowMeta)}>
              Zamknięto {formatShortDate(watch.closed_at)}
            </p>
          ) : null}
        </div>
      ) : null}

      {showSubiektRealizedCloseHint && canEdit ? (
        <p className="rounded-md border border-emerald-200/80 bg-emerald-50/70 px-3 py-2 text-xs leading-snug text-emerald-900">
          Subiekt: Zrealizowane — rozważ zamknięcie sprawy (menu na karcie ZK).
        </p>
      ) : null}
    </ZkWatchModalSection>
  );
}
