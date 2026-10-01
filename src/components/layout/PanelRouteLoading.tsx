import { cn } from "@/lib/cn";
import {
  panelPageShellClass,
  panelWorkspaceShellClass,
  salesPageShellClass,
} from "@/lib/ui/ontime-theme";

function PulseBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded bg-slate-100 motion-safe:animate-pulse",
        className
      )}
    />
  );
}

function PanelCardSkeletonHeader({
  titleClassName = "h-5 w-40",
  descriptionClassName = "mt-2 h-3 w-full max-w-md",
}: {
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  return (
    <div className="border-b border-slate-100 px-3 pb-3 pt-4 sm:px-4">
      <PulseBlock className={cn("rounded bg-slate-200", titleClassName)} />
      <PulseBlock className={descriptionClassName} />
    </div>
  );
}

/** Skeleton panelu dziennego — ten sam układ co w Suspense na /podsumowanie. */
export function PanelDailyRouteLoadingSkeleton({
  label = "Ładowanie panelu dziennego",
}: {
  label?: string;
}) {
  return (
    <div
      className={cn(
        panelWorkspaceShellClass,
        "rounded-lg border border-slate-200 bg-white p-6 motion-safe:animate-pulse sm:p-8"
      )}
      aria-busy="true"
      aria-label={label}
      role="status"
    >
      <div className="h-6 w-48 rounded bg-slate-200" />
      <div className="mt-3 h-4 max-w-lg rounded bg-slate-100" />
      <div className="mt-6 flex gap-2">
        <div className="h-10 w-24 rounded-md bg-slate-100" />
        <div className="h-10 w-24 rounded-md bg-slate-100" />
        <div className="h-10 w-24 rounded-md bg-slate-100" />
      </div>
    </div>
  );
}

/** Skeleton listy /moje — karta + pasek wyszukiwania + wiersze. */
export function PanelSalesRouteLoadingSkeleton({
  label = "Ładowanie Twoich zamówień",
}: {
  label?: string;
}) {
  return (
    <div
      className={cn(salesPageShellClass, "space-y-5")}
      aria-busy="true"
      aria-label={label}
      role="status"
    >
      <div className="flex flex-wrap justify-end gap-2">
        <PulseBlock className="h-9 w-24" />
        <PulseBlock className="h-9 w-9 rounded-md" />
      </div>
      <div className="overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-[var(--shadow-card-elevated)]">
        <PanelCardSkeletonHeader titleClassName="h-5 w-48" />
        <div className="border-b border-slate-100 px-3 py-3 sm:px-4">
          <PulseBlock className="h-11 rounded-md" />
        </div>
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="border-b border-slate-100 px-3 py-4 last:border-0 sm:px-4"
          >
            <PulseBlock className="h-4 w-[62%] rounded bg-slate-200" />
            <PulseBlock className="mt-2.5 h-3 w-[38%]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton /kolejka — karta magazynu + zakładki + lista. */
export function PanelWarehouseRouteLoadingSkeleton({
  label = "Ładowanie kolejki magazynu",
}: {
  label?: string;
}) {
  return (
    <div
      className={cn(panelPageShellClass, "space-y-4")}
      aria-busy="true"
      aria-label={label}
      role="status"
    >
      <div className="overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-[var(--shadow-card-elevated)]">
        <PanelCardSkeletonHeader titleClassName="h-5 w-44" />
        <div className="flex gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
          <PulseBlock className="h-8 w-24 rounded-md bg-slate-200" />
          <PulseBlock className="h-8 w-20 rounded-md" />
          <PulseBlock className="h-8 w-20 rounded-md" />
        </div>
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="border-b border-slate-100 px-3 py-3.5 last:border-0 sm:px-4"
          >
            <div className="flex items-center gap-3">
              <PulseBlock className="h-4 w-4 shrink-0 rounded" />
              <div className="min-w-0 flex-1">
                <PulseBlock className="h-4 w-[55%] rounded bg-slate-200" />
                <PulseBlock className="mt-2 h-3 w-[35%]" />
              </div>
              <PulseBlock className="hidden h-9 w-16 rounded-md sm:block" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton formularza — /prosba i podobne. */
export function PanelFormRouteLoadingSkeleton({
  label = "Ładowanie formularza",
}: {
  label?: string;
}) {
  return (
    <div
      className={cn(salesPageShellClass, "space-y-4")}
      aria-busy="true"
      aria-label={label}
      role="status"
    >
      <div className="overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-[var(--shadow-card-elevated)]">
        <PanelCardSkeletonHeader titleClassName="h-5 w-36" />
        <div className="space-y-4 px-3 py-5 sm:px-4">
          <PulseBlock className="h-10 rounded-md" />
          <PulseBlock className="h-10 rounded-md" />
          <PulseBlock className="h-24 rounded-md" />
          <PulseBlock className="h-11 w-full rounded-md bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton panelu admin — siatka kart. */
export function PanelAdminRouteLoadingSkeleton({
  label = "Ładowanie panelu administracji",
}: {
  label?: string;
}) {
  return (
    <div
      className="mx-auto w-full max-w-5xl space-y-5"
      aria-busy="true"
      aria-label={label}
      role="status"
    >
      <PulseBlock className="h-8 w-56 rounded bg-slate-200" />
      <PulseBlock className="h-4 w-full max-w-xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((card) => (
          <div
            key={card}
            className="rounded-lg border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-card)]"
          >
            <PulseBlock className="h-5 w-32 rounded bg-slate-200" />
            <PulseBlock className="mt-3 h-3 w-full" />
            <PulseBlock className="mt-2 h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export type PanelRouteLoadingVariant =
  | "daily"
  | "sales"
  | "warehouse"
  | "form"
  | "admin";

export function PanelRouteLoading({
  variant,
  label,
}: {
  variant: PanelRouteLoadingVariant;
  label?: string;
}) {
  switch (variant) {
    case "daily":
      return <PanelDailyRouteLoadingSkeleton label={label} />;
    case "sales":
      return <PanelSalesRouteLoadingSkeleton label={label} />;
    case "warehouse":
      return <PanelWarehouseRouteLoadingSkeleton label={label} />;
    case "form":
      return <PanelFormRouteLoadingSkeleton label={label} />;
    case "admin":
      return <PanelAdminRouteLoadingSkeleton label={label} />;
  }
}
