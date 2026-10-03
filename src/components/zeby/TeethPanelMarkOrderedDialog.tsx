"use client";

import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  teethMarkOrderedConfirmLabel,
  teethMarkOrderedConfirmMessage,
  type TeethMarkOrderedAnalysis,
} from "@/lib/teeth/teeth-mark-ordered";
import { TEETH_MARK_ORDERED_LABEL } from "@/components/zeby/teeth-panel-copy";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import type { TeethMarkPlan, TeethMarkScope } from "@/lib/teeth/teeth-queue-view-model";

const PLAN_PREVIEW_LIMIT = 8;

function zebow(n: number): string {
  return polishPluralWord(n, "ząb", "zęby", "zębów");
}

function MarkPlanPreview({ plan, scope }: { plan: TeethMarkPlan; scope: TeethMarkScope }) {
  const partial = scope === "selection" && plan.leftInQueue > 0;
  const shown = plan.rows.slice(0, PLAN_PREVIEW_LIMIT);
  const hidden = plan.rows.length - shown.length;
  return (
    <div className="mt-3 space-y-2">
      <p
        className={cn(
          "rounded-lg px-3 py-2 text-xs font-medium ring-1 ring-inset",
          partial
            ? "bg-indigo-50 text-indigo-900 ring-indigo-200"
            : "bg-amber-50 text-amber-900 ring-amber-200",
        )}
      >
        {partial ? (
          <>
            Tylko zaznaczone: {plan.markCount} {zebow(plan.markCount)}. Pozostałe {plan.leftInQueue}{" "}
            {zebow(plan.leftInQueue)} u tego dostawcy zostaną w kolejce.
          </>
        ) : scope === "all" ? (
          <>Wszystkie niezamówione zęby z kompletnych próśb u dostawcy - {plan.markCount} {zebow(plan.markCount)}.</>
        ) : (
          <>Zaznaczone zęby - {plan.markCount} {zebow(plan.markCount)}.</>
        )}
      </p>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-xs">
        {shown.map((row) => (
          <li key={row.orderId} className="flex items-start justify-between gap-3 px-3 py-1.5">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">
                {row.who}
                {row.context ? <span className="font-normal text-slate-500"> · {row.context}</span> : null}
              </p>
              <p className="truncate text-[11px] text-slate-500">{row.lineLabel}</p>
            </div>
            <span
              className={cn(
                "shrink-0 tabular-nums",
                row.marking < row.open ? "font-semibold text-indigo-700" : "text-slate-700",
              )}
            >
              {row.marking < row.open ? `${row.marking} z ${row.open}` : `${row.marking}`}{" "}
              {zebow(row.marking < row.open ? row.open : row.marking)}
            </span>
          </li>
        ))}
        {hidden > 0 ? (
          <li className="px-3 py-1.5 text-slate-500">…i {hidden} więcej</li>
        ) : null}
      </ul>
    </div>
  );
}

export function TeethPanelMarkOrderedDialog({
  open,
  analysis,
  plan,
  scope = "selection",
  supplierName,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  analysis: TeethMarkOrderedAnalysis | null;
  plan?: TeethMarkPlan | null;
  scope?: TeethMarkScope;
  supplierName?: string | null;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!analysis || analysis.orderIds.length === 0) return null;

  const canConfirm = analysis.canMarkAny;

  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title={TEETH_MARK_ORDERED_LABEL}
      role="alertdialog"
      size="sm"
      tier="raised"
      disableBackdropClose={pending}
      loadingMessage={pending ? "Oznaczanie…" : null}
      bodyClassName="px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            className="min-h-11 w-full sm:w-auto"
            onClick={onCancel}
            disabled={pending}
          >
            Anuluj
          </Button>
          {canConfirm ? (
            <Button
              className="min-h-11 w-full sm:w-auto"
              onClick={onConfirm}
              disabled={pending}
            >
              {plan && plan.markCount > 0
                ? `Oznacz ${plan.markCount} ${zebow(plan.markCount)}`
                : teethMarkOrderedConfirmLabel(analysis)}
            </Button>
          ) : null}
        </div>
      }
    >
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
        {teethMarkOrderedConfirmMessage(analysis, supplierName)}
      </p>
      {canConfirm && plan && plan.rows.length > 0 ? <MarkPlanPreview plan={plan} scope={scope} /> : null}
    </ModalShell>
  );
}
