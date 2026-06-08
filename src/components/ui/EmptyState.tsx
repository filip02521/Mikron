import { IconInbox } from "@/components/icons/StrokeIcons";
import { BrandCardAccent } from "@/components/brand/BrandCardAccent";
import { cn } from "@/lib/cn";
import { brandIconTileClass } from "@/lib/ui/ontime-theme";

export function EmptyState({
  title,
  description,
  action,
  icon,
  brandAccent = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  /** Delikatna tarcza marki (jak na logowaniu) — puste stany hero. */
  brandAccent?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center px-4 py-10 text-center sm:px-6 sm:py-14",
        brandAccent && "overflow-hidden"
      )}
    >
      {brandAccent ? (
        <BrandCardAccent className="pointer-events-none absolute -right-10 -top-12 h-32 w-40 opacity-75" />
      ) : null}
      <div className="relative z-[1] flex flex-col items-center">
        <div
          className={cn(
            "mb-4 flex h-14 w-14 items-center justify-center rounded-lg",
            brandAccent ? cn(brandIconTileClass, "text-white") : "bg-slate-100 text-slate-500"
          )}
        >
          {icon ?? <IconInbox size={28} strokeWidth={1.75} />}
        </div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {description && (
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
            {description}
          </p>
        )}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
