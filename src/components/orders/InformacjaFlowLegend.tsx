import {
  INFORMACJA_FLOW_DIRECT,
  INFORMACJA_FLOW_VIA_PANEL,
} from "@/lib/orders/informacja-flow-copy";
import { cn } from "@/lib/cn";

export function InformacjaFlowLegend({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <p className={cn("text-[11px] leading-relaxed text-slate-600", className)}>
        <span className="font-medium text-slate-800">{INFORMACJA_FLOW_VIA_PANEL.label}:</span>{" "}
        panel Dziś → magazyn → e-mail.{" "}
        <span className="font-medium text-slate-800">{INFORMACJA_FLOW_DIRECT.label}:</span> od razu
        magazyn → e-mail.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-2 text-[11px] leading-relaxed text-slate-700 sm:grid-cols-2",
        className
      )}
    >
      <FlowCard flow={INFORMACJA_FLOW_VIA_PANEL} tone="sky" />
      <FlowCard flow={INFORMACJA_FLOW_DIRECT} tone="slate" />
    </div>
  );
}

type InformacjaFlowDef = typeof INFORMACJA_FLOW_VIA_PANEL | typeof INFORMACJA_FLOW_DIRECT;

function FlowCard({
  flow,
  tone,
}: {
  flow: InformacjaFlowDef;
  tone: "sky" | "slate";
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-2",
        tone === "sky" ? "border-sky-200 bg-sky-50/90" : "border-slate-200 bg-slate-50"
      )}
    >
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
