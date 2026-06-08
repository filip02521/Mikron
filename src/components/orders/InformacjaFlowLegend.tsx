import { Badge } from "@/components/ui/Badge";
import {
  INFORMACJA_FLOW_DIRECT,
  INFORMACJA_FLOW_LEGEND_PANEL,
  INFORMACJA_FLOW_PROCUREMENT_GROUP_BANNER,
  INFORMACJA_VIA_PANEL_BADGE,
} from "@/lib/orders/informacja-flow-copy";
import {
  INFORMACJA_FLOW_UI,
  INFORMACJA_VIA_PANEL_UI,
  type InformacjaFlowUiDef,
} from "@/lib/orders/informacja-flow-ui";
import { cn } from "@/lib/cn";

/** Jednolinijkowy dopisek w sekcji Prośby handlowców — tylko gdy są prośby „Magazyn → info”. */
export function InformacjaViaPanelProcurementCallout({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border-b border-indigo-100/90 bg-indigo-50/45 px-3 py-2.5 sm:px-4",
        className
      )}
    >
      <div className="flex flex-wrap items-start gap-2">
        <Badge variant="default" className="shrink-0 text-[10px]">
          {INFORMACJA_VIA_PANEL_BADGE}
        </Badge>
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-indigo-950">
          {INFORMACJA_FLOW_PROCUREMENT_GROUP_BANNER}
        </p>
      </div>
    </div>
  );
}

/** Wprowadzenie sekcji „Prośby tylko o dostępność” — bez zamawiania u dostawcy. */
export function InformacjaDirectQueueIntro({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border-b border-violet-100/90 bg-violet-50/40 px-3 py-2.5 sm:px-4",
        className
      )}
    >
      <p className="text-xs leading-relaxed text-violet-950">
        <strong className="font-semibold text-violet-950">Tylko dostępność</strong> — handlowiec
        czeka na e-mail z magazynu po przyjęciu towaru.{" "}
        <span className="text-violet-900/85">
          Zamówienia u dostawcy obsługujesz w Prośbach handlowców (badge{" "}
          <span className="font-medium">{INFORMACJA_VIA_PANEL_BADGE}</span>).
        </span>
      </p>
    </div>
  );
}

export function InformacjaFlowLegend({
  className,
  variant = "full",
}: {
  className?: string;
  /** Pełna legenda (formularze). Panel Dziś używa wąskich calloutów powyżej. */
  variant?: "full";
}) {
  if (variant !== "full") return null;

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

function FlowCard({ flow }: { flow: InformacjaFlowUiDef }) {
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

/** Pełna legenda ze wszystkimi ścieżkami — np. pomoc w formularzu. */
export function InformacjaFlowLegendDetailed({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <InformacjaFlowLegend variant="full" />
      <div className="rounded-md border border-indigo-200 bg-indigo-50/90 px-2.5 py-2 text-[11px] leading-relaxed text-slate-700">
        <p className="font-medium text-slate-900">{INFORMACJA_VIA_PANEL_UI.label}</p>
        <p className="mt-0.5 text-slate-600">{INFORMACJA_VIA_PANEL_UI.short}</p>
        <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-slate-600">
          {INFORMACJA_VIA_PANEL_UI.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      <p className="text-[11px] text-slate-500">
        {INFORMACJA_FLOW_DIRECT.label} — domyślna ścieżka w formularzu handlowca (kolejka magazynu).
      </p>
    </div>
  );
}
