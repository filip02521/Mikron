"use client";

import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import {
  zdEstimateLoadingWindowClass,
  zdEstimateRecountOverlayPlaceClass,
} from "@/lib/ui/ontime-theme";

/**
 * Overlay przeliczania listy — ta sama kotwica pionowa co LaunchProgress
 * (pełny workbench, od góry), ten sam język karty co LoadingWindow.
 */
export function ZdEstimateRecountOverlay({
  message,
  hint,
  className,
}: {
  message: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
      className={cn(zdEstimateRecountOverlayPlaceClass, className)}
    >
      <div
        className="zd-est-recount-overlay__veil pointer-events-none absolute inset-0"
        aria-hidden
      />
      <div
        className="zd-est-loading-bar zd-est-loading-bar--indeterminate pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden"
        aria-hidden
      >
        <div className="zd-est-loading-bar__fill zd-est-loading-bar__fill--sweep h-full w-1/3 rounded-full bg-indigo-500" />
      </div>

      <div
        className={cn(
          zdEstimateLoadingWindowClass,
          "zd-est-recount-overlay__card relative mx-4 bg-white/95 px-5 py-4 backdrop-blur-sm sm:max-w-[24.5rem]"
        )}
      >
        <div className="flex items-start gap-3.5">
          <span className="zd-est-loading-status-icon mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 ring-1 ring-indigo-100/90">
            <Spinner
              size="sm"
              className="border-indigo-200 border-t-indigo-600"
            />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[0.9375rem] font-semibold leading-snug tracking-tight text-slate-900">
              {message}
            </p>
            {hint ? (
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                {hint}
              </p>
            ) : null}
          </div>
        </div>
        <div
          className="zd-est-loading-bar mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200/85"
          aria-hidden
        >
          <div className="zd-est-loading-bar__fill zd-est-loading-bar__fill--indeterminate h-full w-2/5 rounded-full bg-indigo-500" />
        </div>
      </div>
    </div>
  );
}
