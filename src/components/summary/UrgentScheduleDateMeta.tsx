import { cn } from "@/lib/cn";
import {
  buildUrgentScheduleDateMeta,
  urgentScheduleDateLabelClassName,
  urgentScheduleDateMetaClassName,
  type UrgentCardTone,
} from "@/components/summary/urgent-card-styles";

/**
 * Termin planu w nagłówku karty harmonogramu (trailing) —
 * zamiast badge „Na dziś” / „Zaległe” w stripie chipów.
 * Wzorzec jak {@link PlannedOrderDateMeta} density=panel.
 */
export function UrgentScheduleDateMeta({
  tone,
  dateLabel,
  className,
}: {
  tone: UrgentCardTone;
  dateLabel: string;
  className?: string;
}) {
  const meta = buildUrgentScheduleDateMeta({ tone, dateLabel });
  return (
    <div
      className={urgentScheduleDateMetaClassName(className)}
      title={meta.title}
    >
      <span className={cn(meta.captionClass, "whitespace-nowrap")}>{meta.caption}</span>
      <span className={urgentScheduleDateLabelClassName(meta.labelClass)}>{meta.label}</span>
    </div>
  );
}
