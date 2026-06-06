import { INFORMACJA_FLOW_LEGEND_PANEL } from "@/lib/orders/informacja-flow-copy";
import {
  INFORMACJA_FLOW_UI,
  INFORMACJA_VIA_PANEL_UI,
} from "@/lib/orders/informacja-flow-ui";
import { FlowSteps } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";

export function InformacjaFlowLegend({
  className,
  compact = false,
  showLegacyViaPanel = false,
}: {
  className?: string;
  compact?: boolean;
  /** Starsze prośby z flagą via_panel — dopisek w legendzie panelu. */
  showLegacyViaPanel?: boolean;
}) {
  if (compact) {
    return (
      <ul className={cn("space-y-1 text-[11px] leading-relaxed text-slate-600", className)}>
        {INFORMACJA_FLOW_UI.map((flow) => (
          <li key={flow.path} className="flex gap-1.5">
            <span className="font-medium text-slate-800 shrink-0">{flow.label}:</span>
            <FlowSteps steps={flow.steps} chevronClassName="text-indigo-300" />
          </li>
        ))}
        {showLegacyViaPanel ? (
          <li className="flex gap-1.5 border-t border-slate-200/80 pt-1 text-slate-500">
            <span className="font-medium text-slate-700 shrink-0">
              {INFORMACJA_VIA_PANEL_UI.lineBadge} (starsze):
            </span>
            <FlowSteps steps={INFORMACJA_VIA_PANEL_UI.steps} chevronClassName="text-slate-300" />
          </li>
        ) : null}
      </ul>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[11px] leading-relaxed text-slate-600">
        {INFORMACJA_FLOW_LEGEND_PANEL}
      </p>
      <div className="grid gap-2 text-[11px] leading-relaxed text-slate-700 sm:grid-cols-2">
        {INFORMACJA_FLOW_UI.map((flow) => (
          <FlowCard key={flow.path} flow={flow} />
        ))}
      </div>
    </div>
  );
}

function FlowCard({
  flow,
}: {
  flow: (typeof INFORMACJA_FLOW_UI)[number];
}) {
  const borderTone =
    flow.tone === "amber"
      ? "border-amber-200 bg-amber-50/90"
      : flow.tone === "indigo"
        ? "border-indigo-200 bg-indigo-50/90"
        : "border-violet-200 bg-violet-50/90";

  return (
    <div className={cn("rounded-md border px-2.5 py-2", borderTone)}>
      <p className="font-medium text-slate-900">{flow.label}</p>
      <p className="mt-0.5 text-slate-600">{flow.short}</p>
      <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-slate-600">
        {flow.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
