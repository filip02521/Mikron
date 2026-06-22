"use client";

import { useTransition } from "react";
import { actionSetAdminPanelContext } from "@/app/actions/admin-panel-context";
import { runServerActionWithRedirect } from "@/lib/client/server-action-redirect";
import {
  ADMIN_PANEL_CONTEXT_OPTIONS,
  type AdminPanelContext,
} from "@/lib/auth/admin-panel-context";
import { cn } from "@/lib/cn";

export function AdminPanelContextSwitcher({
  current,
}: {
  current: AdminPanelContext;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="mb-3 px-3">
      <label
        htmlFor="admin-panel-context"
        className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
      >
        Podgląd panelu
      </label>
      <select
        id="admin-panel-context"
        value={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as AdminPanelContext;
          startTransition(() => {
            void runServerActionWithRedirect(() => actionSetAdminPanelContext(next));
          });
        }}
        className={cn(
          "w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 shadow-sm",
          "focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100",
          pending && "cursor-wait opacity-60"
        )}
      >
        {ADMIN_PANEL_CONTEXT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value} title={opt.title}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
