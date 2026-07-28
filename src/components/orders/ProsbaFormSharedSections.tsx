"use client";

import type { ReactNode } from "react";
import { IconAvailability, IconPackageCheck, IconPlusCircle } from "@/components/icons/StrokeIcons";
import { InformacjaFlowPicker } from "@/components/orders/InformacjaFlowPicker";
import { ProsbaFormMetaStrip } from "@/components/orders/ProsbaFormMetaStrip";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
import { TeethShortageLookupButton } from "@/components/teeth/TeethShortageLookupModal";
import { RequestKindToggle } from "@/components/orders/RequestKindToggle";
import { SalesKeyboardShortcutsStrip } from "@/components/sales/SalesKeyboardShortcutsStrip";
import { PROSBA_FORM_SECTION_COPY } from "@/lib/orders/prosba-form-section-copy";
import {
  INFORMACJA_FLOW_PICKER_SECTION,
  INFORMACJA_FLOW_PICKER_SECTION_DAILY,
  informacjaProductsFormHint,
} from "@/lib/orders/informacja-flow-ui";
import type { InformacjaFlowPath } from "@/lib/orders/informacja-stock-out-reorder";
import type { IndividualRequestKind } from "@/types/database";
import { cn } from "@/lib/cn";
import { sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";
import type { KeyboardShortcutItem } from "@/components/ui/KeyboardShortcutsHint";

export function ProsbaFormKeyboardStrip({
  hints,
  variant = "sales",
  className,
}: {
  hints: readonly KeyboardShortcutItem[];
  variant?: "sales" | "procurement";
  className?: string;
}) {
  if (variant === "sales") {
    return <ProsbaFormMetaStrip keyboardHints={hints} className={className} />;
  }
  return (
    <SalesKeyboardShortcutsStrip
      items={hints}
      embedded
      className={cn("border-b border-slate-100 bg-slate-50/60 sm:px-2", className)}
    />
  );
}

export function ProsbaFormRequestKindSection({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: IndividualRequestKind;
  onChange: (kind: IndividualRequestKind) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <ProsbaFormSection
      title={PROSBA_FORM_SECTION_COPY.requestKind.title}
      hint={PROSBA_FORM_SECTION_COPY.requestKind.hint}
      accent="indigo"
      icon={<IconPlusCircle size={17} />}
      tileClassName={sectionIconTileBrandClass}
      className={className}
    >
      <RequestKindToggle
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </ProsbaFormSection>
  );
}

export function ProsbaFormInformacjaSection({
  path,
  onChange,
  disabled = false,
  includeViaPanel = false,
  className,
}: {
  path: InformacjaFlowPath;
  onChange: (path: InformacjaFlowPath) => void;
  disabled?: boolean;
  /** Panel dzienny — 3 opcje (direct, via_panel, stock_out). */
  includeViaPanel?: boolean;
  className?: string;
}) {
  const section = includeViaPanel
    ? INFORMACJA_FLOW_PICKER_SECTION_DAILY
    : INFORMACJA_FLOW_PICKER_SECTION;

  return (
    <ProsbaFormSection
      title={section.title}
      hint={section.hint}
      accent="violet"
      icon={<IconAvailability size={17} />}
      tileClassName="bg-violet-100 text-violet-800"
      className={className}
    >
      <InformacjaFlowPicker
        path={path}
        onChange={onChange}
        disabled={disabled}
        includeViaPanel={includeViaPanel}
      />
    </ProsbaFormSection>
  );
}

export function ProsbaFormProductsSection({
  requestKind,
  informacjaPath,
  hint,
  children,
  className,
  showShortageLookup = true,
}: {
  requestKind: IndividualRequestKind;
  informacjaPath: InformacjaFlowPath;
  hint?: string;
  children: ReactNode;
  className?: string;
  showShortageLookup?: boolean;
}) {
  const isInformacja = requestKind === "informacja";
  const productsHint =
    hint ??
    (isInformacja
      ? informacjaProductsFormHint(informacjaPath)
      : PROSBA_FORM_SECTION_COPY.products.orderHint);

  return (
    <ProsbaFormSection
      title={PROSBA_FORM_SECTION_COPY.products.title}
      hint={productsHint}
      accent={isInformacja ? "violet" : "slate"}
      icon={<IconPackageCheck size={17} />}
      tileClassName={
        isInformacja ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-700"
      }
      className={className}
    >
      {showShortageLookup && !isInformacja ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/70 bg-amber-50/40 px-2.5 py-2">
          <p className="min-w-0 text-[11px] leading-snug text-amber-900/85">
            Zanim wyślesz prośbę o zęby — sprawdź, czy wariant nie jest na liście braków.
          </p>
          <TeethShortageLookupButton className="shrink-0" />
        </div>
      ) : null}
      {children}
    </ProsbaFormSection>
  );
}
