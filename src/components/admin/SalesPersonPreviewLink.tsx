"use client";

import { useState, useTransition } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { actionOpenSalesPersonPreview } from "@/app/actions/admin-panel-context";
import { cn } from "@/lib/cn";

export function SalesPersonPreviewLink({
  salesPersonId,
  name,
  email,
}: {
  salesPersonId: string;
  name: string;
  email: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(() => {
            void actionOpenSalesPersonPreview(salesPersonId).catch((e: unknown) => {
              if (isRedirectError(e)) return;
              setError(
                e instanceof Error ? e.message : "Nie udało się otworzyć podglądu"
              );
            });
          });
        }}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50",
          pending && "cursor-wait opacity-70"
        )}
      >
        <span>
          <span className="block text-sm font-semibold text-slate-900">{name}</span>
          {email ? (
            <span className="mt-0.5 block text-xs text-slate-500">{email}</span>
          ) : null}
        </span>
        <span className="shrink-0 text-xs font-medium text-indigo-600">
          {pending ? "Otwieranie…" : "Podgląd →"}
        </span>
      </button>
      {error ? (
        <p className="px-4 pb-2 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
