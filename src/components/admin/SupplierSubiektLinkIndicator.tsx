import { IconLink, IconLinkOff } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

export function SupplierSubiektLinkIndicator({
  subiektKhId,
  className,
  size = 16,
}: {
  subiektKhId?: number | null;
  className?: string;
  size?: number;
}) {
  const linked = subiektKhId != null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md p-0.5",
        linked ? "text-indigo-600 bg-indigo-50" : "text-slate-300 bg-slate-50",
        className
      )}
      title={
        linked
          ? `Powiązany z Subiektem (kh_Id ${subiektKhId})`
          : "Brak powiązania z kontrahentem Subiekt"
      }
      aria-label={
        linked
          ? `Powiązany z Subiektem, identyfikator ${subiektKhId}`
          : "Brak powiązania z Subiektem"
      }
    >
      {linked ? (
        <IconLink size={size} strokeWidth={2.25} />
      ) : (
        <IconLinkOff size={size} strokeWidth={2} />
      )}
    </span>
  );
}
