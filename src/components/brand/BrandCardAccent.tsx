import { authTickLines } from "@/components/auth/auth-background-geometry";
import { cn } from "@/lib/cn";

/** Delikatny wycinek tarczy — karty onboardingowe i puste stany „hero”. */
export function BrandCardAccent({ className }: { className?: string }) {
  const cx = 120;
  const cy = 20;
  const ticks = authTickLines(cx, cy, 95, 0.9, 3);

  return (
    <svg
      className={cn("pointer-events-none text-indigo-600", className)}
      aria-hidden
      viewBox="0 0 160 120"
    >
      <circle
        cx={cx}
        cy={cy}
        r="105"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.07"
        strokeWidth="1"
      />
      {ticks
        .filter((tick) => tick.major)
        .map((tick, i) => (
          <line
            key={i}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        ))}
    </svg>
  );
}
