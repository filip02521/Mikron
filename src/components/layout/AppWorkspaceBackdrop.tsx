/** Subtelne tło panelu — echo tarczy OnTime z logowania (rogi viewportu, bez animacji). */

import { authTickLines } from "@/components/auth/auth-background-geometry";

export function AppWorkspaceBackdrop() {
  const topRightCx = 720;
  const topRightCy = -30;
  const topRightTicks = authTickLines(topRightCx, topRightCy, 220, 0.9, 3);

  const bottomLeftCx = -40;
  const bottomLeftCy = 880;
  const bottomLeftTicks = authTickLines(bottomLeftCx, bottomLeftCy, 200, 0.9, 3);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden md:left-64"
      aria-hidden
    >
      <div className="pointer-events-none absolute -right-16 top-[10%] h-44 w-44 rounded-full bg-indigo-200/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 bottom-[12%] h-36 w-36 rounded-full bg-sky-200/20 blur-3xl" />

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 800 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle
          cx={topRightCx}
          cy={topRightCy}
          r="240"
          fill="none"
          stroke="#6366f1"
          strokeOpacity="0.045"
          strokeWidth="1"
        />
        {topRightTicks
          .filter((tick) => tick.major)
          .map((tick, i) => (
            <line
              key={`tr-${i}`}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke="#6366f1"
              strokeOpacity="0.065"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          ))}

        <circle
          cx={bottomLeftCx}
          cy={bottomLeftCy}
          r="210"
          fill="none"
          stroke="#0284c7"
          strokeOpacity="0.04"
          strokeWidth="1"
        />
        {bottomLeftTicks
          .filter((tick) => tick.major)
          .map((tick, i) => (
            <line
              key={`bl-${i}`}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke="#0284c7"
              strokeOpacity="0.055"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          ))}
      </svg>
    </div>
  );
}
