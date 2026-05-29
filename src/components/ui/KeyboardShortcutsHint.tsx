import { cn } from "@/lib/cn";
import { Kbd } from "@/components/ui/Kbd";

export type KeyboardShortcutItem = {
  keys: readonly string[];
  label: string;
};

export function KeyboardShortcutsHint({
  items,
  className,
  compact,
}: {
  items: KeyboardShortcutItem[];
  className?: string;
  compact?: boolean;
}) {
  if (!items.length) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500",
        className
      )}
      aria-label="Skróty klawiszowe"
    >
      {!compact ? (
        <span className="font-medium text-slate-600">Skróty:</span>
      ) : null}
      {items.map((item) => (
        <span key={`${item.label}-${item.keys.join("-")}`} className="inline-flex items-center gap-1">
          <span className="inline-flex items-center gap-0.5">
            {item.keys.map((key, i) => (
              <Kbd key={`${item.label}-${key}-${i}`}>{key}</Kbd>
            ))}
          </span>
          {item.label ? <span>{item.label}</span> : null}
        </span>
      ))}
    </div>
  );
}
