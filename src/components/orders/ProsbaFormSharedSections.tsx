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
  /** /prosba — bez violet shell + ikony. */
  plain = false,
}: {
  path: InformacjaFlowPath;
  onChange: (path: InformacjaFlowPath) => void;
  disabled?: boolean;
  /** Panel dzienny — 3 opcje (direct, via_panel, stock_out). */
  includeViaPanel?: boolean;
  className?: string;
  plain?: boolean;
}) {
  const section = includeViaPanel
    ? INFORMACJA_FLOW_PICKER_SECTION_DAILY
    : INFORMACJA_FLOW_PICKER_SECTION;

  return (
    <ProsbaFormSection
      title={section.title}
      hint={section.hint}
      className={className}
      {...(plain
        ? {}
        : {
            accent: "violet" as const,
            icon: <IconAvailability size={17} />,
            tileClassName: "bg-violet-100 text-violet-800",
          })}
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
  /** /prosba — bez drugiej karty z ikoną (jak „Co chcesz zgłosić?”). */
  plain = false,
}: {
  requestKind: IndividualRequestKind;
  informacjaPath: InformacjaFlowPath;
  hint?: string;
  children: ReactNode;
  className?: string;
  showShortageLookup?: boolean;
  plain?: boolean;
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
      className={className}
      {...(plain
        ? {}
        : {
            accent: (isInformacja ? "violet" : "slate") as "violet" | "slate",
            icon: <IconPackageCheck size={17} />,
            tileClassName: isInformacja
              ? "bg-violet-100 text-violet-800"
              : "bg-slate-100 text-slate-700",
          })}
    >
      {showShortageLookup && !isInformacja ? (
        <div className="mb-2 flex justify-end">
          <TeethShortageLookupButton className="shrink-0" />
        </div>
      ) : null}
      {children}
    </ProsbaFormSection>
  );
}
