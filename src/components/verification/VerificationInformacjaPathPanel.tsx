"use client";

import type { VerificationInformacjaUi } from "@/lib/orders/verification-informacja-ui";
import { IconAvailability } from "@/components/icons/StrokeIcons";
import { InformacjaFlowPicker } from "@/components/orders/InformacjaFlowPicker";
import { INFORMACJA_FLOW_PICKER_SECTION_DAILY } from "@/lib/orders/informacja-flow-ui";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
import { Badge } from "@/components/ui/Badge";
import type { InformacjaFlowPath } from "@/lib/orders/informacja-stock-out-reorder";
import { cn } from "@/lib/cn";

const BADGE_VARIANT: Record<
  VerificationInformacjaUi["badgeTone"],
  "warning" | "info" | "purple" | "default"
> = {
  warning: "warning",
  info: "info",
  violet: "purple",
  neutral: "default",
};

export function VerificationPathBadge({
  ui,
  className,
}: {
  ui: VerificationInformacjaUi;
  className?: string;
}) {
  return (
    <Badge variant={BADGE_VARIANT[ui.badgeTone]} className={cn("shrink-0", className)}>
      {ui.badgeLabel}
    </Badge>
  );
}

export function VerificationInformacjaPathPanel({
  ui,
  path,
  onPathChange,
}: {
  ui: VerificationInformacjaUi;
  path: InformacjaFlowPath;
  onPathChange: (path: InformacjaFlowPath) => void;
}) {
  if (ui.pathLocked) {
    const borderTone =
      ui.path === "stock_out"
        ? "border-amber-300/90 bg-amber-50/90 text-amber-950"
        : "border-indigo-300/90 bg-indigo-50/90 text-indigo-950";

    return (
      <ProsbaFormSection
        title="Ścieżka informacji"
        hint="Wybrana przez handlowca — nie zmienia się przy uzupełnianiu."
        accent="violet"
        icon={<IconAvailability size={17} />}
        tileClassName="bg-violet-100 text-violet-800"
      >
        <div className={cn("rounded-md border px-3 py-3 text-sm leading-relaxed", borderTone)}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <VerificationPathBadge ui={ui} />
            <span className="text-xs font-medium uppercase tracking-wide opacity-70">
              Zablokowana
            </span>
          </div>
          {ui.lockedReason ? <p>{ui.lockedReason}</p> : null}
          <p className="mt-2 text-xs opacity-90">{ui.destinationSummary}</p>
        </div>
      </ProsbaFormSection>
    );
  }

  return (
    <ProsbaFormSection
      title={INFORMACJA_FLOW_PICKER_SECTION_DAILY.title}
      hint={INFORMACJA_FLOW_PICKER_SECTION_DAILY.hint}
      accent="violet"
      icon={<IconAvailability size={17} />}
      tileClassName="bg-violet-100 text-violet-800"
    >
      <InformacjaFlowPicker
        path={path}
        onChange={onPathChange}
        includeViaPanel
      />
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{ui.destinationSummary}</p>
    </ProsbaFormSection>
  );
}
