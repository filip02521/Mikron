"use client";

import { useTransition } from "react";
import { actionSetProcurementWorkspace } from "@/app/actions/procurement-workspace";
import { runServerActionWithRedirect } from "@/lib/client/server-action-redirect";
import {
  PROCUREMENT_WORKSPACE_OPTIONS,
  type ProcurementWorkspace,
} from "@/lib/auth/procurement-workspace";
import { cn } from "@/lib/cn";

export function ProcurementWorkspaceSwitcher({
  current,
  options = PROCUREMENT_WORKSPACE_OPTIONS,
}: {
  current: ProcurementWorkspace;
  options?: typeof PROCUREMENT_WORKSPACE_OPTIONS;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="mb-3 px-3">
      <label
        htmlFor="procurement-workspace"
        className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
      >
        Obszar pracy
      </label>
      <select
        id="procurement-workspace"
        value={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as ProcurementWorkspace;
          startTransition(() => {
            void runServerActionWithRedirect(() => actionSetProcurementWorkspace(next));
          });
        }}
        className={cn(
          "w-full rounded-md border border-emerald-200/80 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 shadow-sm",
          "focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100",
          pending && "cursor-wait opacity-60"
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} title={opt.title}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
