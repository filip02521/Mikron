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
        <svg className={base} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M6 14c0-4.4 3.6-8 8-8h4c4.4 0 8 3.6 8 8 0 5-3 9-7 11-1 .4-2 .6-3 .6s-2-.2-3-.6C9 23 6 19 6 14Z"
            fill="currentColor"
            fillOpacity="0.08"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M10 13.5c1.5-1 3-1.5 5-1.5s3.5.5 5 1.5"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            opacity="0.5"
          />
          <path
            d="M11 17c1.5-1 3.2-1.5 5-1.5s3.5.5 5 1.5"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.35"
          />
          <path
            d="M14 6.5c0-1 .5-2 1.5-2s1.5 1 1.5 2"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            opacity="0.6"
          />
        </svg>
      );
    case "lower":
      return (
        <svg className={base} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M6 18c0 4.4 3.6 8 8 8h4c4.4 0 8-3.6 8-8 0-5-3-9-7-11-1-.4-2-.6-3-.6s-2 .2-3 .6C9 9 6 13 6 18Z"
            fill="currentColor"
            fillOpacity="0.08"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M10 18.5c1.5 1 3 1.5 5 1.5s3.5-.5 5-1.5"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            opacity="0.5"
          />
          <path
            d="M11 15c1.5 1 3.2 1.5 5 1.5s3.5-.5 5-1.5"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.35"
          />
          <path
            d="M14 25.5c0 1 .5 2 1.5 2s1.5-1 1.5-2"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            opacity="0.6"
          />
        </svg>
      );
    case "oval":
      return (
        <svg className={base} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M16 4.5c-3.6 0-6.5 2-8.5 5-1.8 2.7-2.5 6-2.5 8.5 0 4.2 2.5 7.5 5.5 8.5 1.7.6 3.5.8 5.5.8s3.8-.2 5.5-.8c3-1 5.5-4.3 5.5-8.5 0-2.5-.7-5.8-2.5-8.5-2-3-4.9-5-8.5-5Z"
            fill="currentColor"
            fillOpacity="0.08"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M16 7c-2.5 0-4.5 1.5-6 3.5-1.3 1.8-2 4-2 6 0 .5 0 1 .1 1.4"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.4"
          />
          <path
            d="M10.5 22c1.7 1.2 3.5 1.8 5.5 1.8s3.8-.6 5.5-1.8"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.35"
          />
          <path
            d="M16 4.5v3"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.5"
          />
        </svg>
      );
    case "triangular":
      return (
        <svg className={base} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M16 4.5c-1 0-1.8.4-2.3 1.2L7.5 19c-.7 1.2-1 2.5-1 3.8 0 2.2 1.5 3.7 3.5 3.7h12c2 0 3.5-1.5 3.5-3.7 0-1.3-.3-2.6-1-3.8L18.3 5.7C17.8 4.9 17 4.5 16 4.5Z"
            fill="currentColor"
            fillOpacity="0.08"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M16 7.5L10 19"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.4"
          />
          <path
            d="M16 7.5L22 19"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.4"
          />
          <path
            d="M10.5 21.5c1.5 1 3.3 1.5 5.5 1.5s4-.5 5.5-1.5"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.35"
          />
        </svg>
      );
    case "square":
      return (
        <svg className={base} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M8 6.5h16c.8 0 1.5.7 1.5 1.5v13c0 3-2.2 5.5-5 6.5-1.3.5-2.8.7-4.5.7s-3.2-.2-4.5-.7c-2.8-1-5-3.5-5-6.5V8c0-.8.7-1.5 1.5-1.5Z"
            fill="currentColor"
            fillOpacity="0.08"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M11 10v10M21 10v10"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.35"
          />
          <path
            d="M11 20c1.5 1 3.2 1.5 5 1.5s3.5-.5 5-1.5"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.35"
          />
          <path
            d="M11 10h10"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.3"
          />
        </svg>
      );
  }
}
