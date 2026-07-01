import { IconPackage } from "@/components/icons/StrokeIcons";
import {
  boardQuestionHasProduct,
  boardQuestionProductLabel,
  type BoardQuestionProductFields,
} from "@/lib/department-board/question-product";
import { boardQuestionProductChipClass } from "@/lib/department-board/department-board-thread-styles";
import { cn } from "@/lib/cn";

export function BoardQuestionProductChip({
  product,
  className,
  compact = false,
}: {
  product: Partial<BoardQuestionProductFields>;
  className?: string;
  compact?: boolean;
}) {
  if (!boardQuestionHasProduct(product)) return null;

  const label = boardQuestionProductLabel(product);
  const mikran = product.mikran_code?.trim();
  const titleParts = [label, mikran ? `Kod Mikran: ${mikran}` : null].filter(Boolean);

  return (
    <span
      className={cn(boardQuestionProductChipClass, compact && "max-w-full", className)}
      title={titleParts.join(" · ")}
    >
      <IconPackage size={compact ? 12 : 13} className="shrink-0 text-slate-500" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
      {!compact && mikran ? (
        <span className="shrink-0 text-[10px] font-normal text-slate-500">
          · {mikran}
        </span>
      ) : null}
    </span>
  );
}
