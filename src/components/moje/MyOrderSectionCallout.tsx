import type {
  MyOrderSectionCallout,
  MyOrderSectionCalloutTone,
  MyOrderSectionSingleHint,
} from "@/lib/orders/my-order-section-callout";
import { cn } from "@/lib/cn";

const toneClass: Record<MyOrderSectionCalloutTone, string> = {
  warning: "border-amber-100/90 bg-amber-50/50 text-amber-950",
  sky: "border-sky-100/90 bg-sky-50/50 text-sky-950",
  indigo: "border-indigo-100/90 bg-indigo-50/45 text-indigo-950",
};

const detailClass: Record<MyOrderSectionCalloutTone, string> = {
  warning: "text-amber-900/85",
  sky: "text-sky-900/85",
  indigo: "text-indigo-900/85",
};

export function MyOrderSectionCalloutBar({
  callout,
  className,
}: {
  callout: MyOrderSectionCallout;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "border-b px-3 py-2.5 sm:px-4",
        toneClass[callout.tone],
        className
      )}
    >
      <p className="text-xs font-semibold leading-snug">{callout.title}</p>
      <p className={cn("mt-0.5 text-xs leading-relaxed", detailClass[callout.tone])}>
        {callout.detail}
      </p>
    </div>
  );
}

export function MyOrderSectionCalloutList({
  callouts,
  className,
}: {
  callouts: MyOrderSectionCallout[];
  className?: string;
}) {
  if (callouts.length === 0) return null;

  return (
    <div className={cn("divide-y divide-slate-100/80", className)}>
      {callouts.map((callout) => (
        <MyOrderSectionCalloutBar key={callout.pattern} callout={callout} />
      ))}
    </div>
  );
}

export function MyOrderSectionSingleHintBar({
  hint,
  className,
}: {
  hint: MyOrderSectionSingleHint;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "border-b px-3 py-2 text-xs leading-relaxed sm:px-4",
        toneClass[hint.tone],
        detailClass[hint.tone],
        className
      )}
    >
      {hint.message}
    </div>
  );
}

export function MyOrderSectionSingleHintList({
  hints,
  className,
}: {
  hints: MyOrderSectionSingleHint[];
  className?: string;
}) {
  if (hints.length === 0) return null;

  return (
    <div className={cn("divide-y divide-slate-100/80", className)}>
      {hints.map((hint) => (
        <MyOrderSectionSingleHintBar key={hint.pattern} hint={hint} />
      ))}
    </div>
  );
}

export function MyOrderSectionNoticeList({
  callouts,
  singleHints,
  className,
}: {
  callouts: MyOrderSectionCallout[];
  singleHints: MyOrderSectionSingleHint[];
  className?: string;
}) {
  if (callouts.length === 0 && singleHints.length === 0) return null;

  return (
    <div className={className}>
      <MyOrderSectionCalloutList callouts={callouts} />
      <MyOrderSectionSingleHintList hints={singleHints} />
    </div>
  );
}
