import { cn } from "@/lib/cn";
import type { TeethMouldShapeId } from "@/lib/teeth/teeth-mould-shape-groups";

export function TeethMouldShapeIcon({
  shapeId,
  className,
}: {
  shapeId: Exclude<TeethMouldShapeId, "all">;
  className?: string;
}) {
  const base = cn("shrink-0", className);
  switch (shapeId) {
    case "upper":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M8 8.5h8c2.2 0 4 1.8 4 4v2.5c0 3.3-2.7 6-6 6H10c-3.3 0-6-2.7-6-6v-2.5c0-2.2 1.8-4 4-4Z"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path d="M12 7v8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.45" />
          <path
            d="M9 4.5h6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      );
    case "lower":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M8 5.5h8c2.2 0 4 1.8 4 4v2.5c0 3.3-2.7 6-6 6H10c-3.3 0-6-2.7-6-6V9.5c0-2.2 1.8-4 4-4Z"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path d="M12 8v8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.45" />
          <path
            d="M9 19.5h6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      );
    case "oval":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3.5c4.2 0 7.5 3.4 7.5 8.5s-3.3 8.5-7.5 8.5S4.5 17.1 4.5 12 7.8 3.5 12 3.5Z"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M12 6.5v11"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            opacity="0.45"
          />
        </svg>
      );
    case "triangular":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 4 19.5 19.5H4.5L12 4Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path
            d="M12 8v8.5"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            opacity="0.45"
          />
        </svg>
      );
    case "square":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="5.5"
            y="5.5"
            width="13"
            height="13"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M9 12h6M12 9v6"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            opacity="0.45"
          />
        </svg>
      );
  }
}
