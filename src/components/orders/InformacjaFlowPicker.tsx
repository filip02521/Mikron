"use client";

import {
  INFORMACJA_FLOW_DIRECT,
  INFORMACJA_FLOW_VIA_PANEL,
} from "@/lib/orders/informacja-flow-copy";
import { InformacjaFlowLegend } from "@/components/orders/InformacjaFlowLegend";

/** Wybór ścieżki prośby informacyjnej — wspólny dla modalu panelu i zamówienia grupowego. */
export function InformacjaFlowPicker({
  viaDailyPanel,
  onChange,
  disabled = false,
  name = "informacja-path",
}: {
  viaDailyPanel: boolean;
  onChange: (viaDailyPanel: boolean) => void;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <fieldset className="space-y-2 rounded-md border border-sky-200 bg-sky-50/60 px-3 py-2.5">
      <legend className="px-1 text-xs font-semibold text-slate-900">Ścieżka informacji</legend>
      <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
        <input
          type="radio"
          name={name}
          className="mt-0.5"
          checked={!viaDailyPanel}
          onChange={() => onChange(false)}
          disabled={disabled}
        />
        <span>
          <span className="font-medium text-slate-900">{INFORMACJA_FLOW_DIRECT.label}</span>
          <span className="mt-0.5 block text-slate-600">{INFORMACJA_FLOW_DIRECT.short}</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
        <input
          type="radio"
          name={name}
          className="mt-0.5"
          checked={viaDailyPanel}
          onChange={() => onChange(true)}
          disabled={disabled}
        />
        <span>
          <span className="font-medium text-slate-900">{INFORMACJA_FLOW_VIA_PANEL.label}</span>
          <span className="mt-0.5 block text-slate-600">{INFORMACJA_FLOW_VIA_PANEL.short}</span>
        </span>
      </label>
      <InformacjaFlowLegend compact className="border-t border-sky-100 pt-2" />
    </fieldset>
  );
}
