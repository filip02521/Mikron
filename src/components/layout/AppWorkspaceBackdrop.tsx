/** Subtelne tło panelu — echo tarczy OnTime z logowania (rogi viewportu, bez animacji). */

import { authTickLines } from "@/components/auth/auth-background-geometry";

export function AppWorkspaceBackdrop({ uniformBackground }: { uniformBackground: boolean }) {
  if (uniformBackground) return null;

  const topRightCx = 680;
  const topRightCy = 60;
  const topRightTicks = authTickLines(topRightCx, topRightCy, 200, 0.9, 3);

  const bottomLeftCx = 80;
  const bottomLeftCy = 780;
  const bottomLeftTicks = authTickLines(bottomLeftCx, bottomLeftCy, 180, 0.9, 3);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden md:left-64"
      aria-hidden
    >
      <div className="pointer-events-none absolute -right-20 top-[6%] h-56 w-56 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 bottom-[8%] h-48 w-48 rounded-full bg-sky-200/25 blur-3xl" />
      <div className="pointer-events-none absolute right-[30%] top-[40%] h-36 w-36 rounded-full bg-indigo-100/20 blur-2xl" />

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 800 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="app-bg-glow" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#e0e7ff" stopOpacity="0.18" />
            <stop offset="55%" stopColor="#f0f9ff" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="900" fill="url(#app-bg-glow)" />

        {/* Prawy górny róg — tarcza częściowo widoczna */}
        <circle
          cx={topRightCx}
          cy={topRightCy}
          r="220"
          fill="none"
          stroke="#6366f1"
          strokeOpacity="0.10"
          strokeWidth="1.25"
        />
        <circle
          cx={topRightCx}
          cy={topRightCy}
          r="165"
          fill="none"
          stroke="#0284c7"
          strokeOpacity="0.07"
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
              strokeOpacity="0.13"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          ))}

        {/* Lewy dolny róg — echo tarczy */}
        <circle
          cx={bottomLeftCx}
          cy={bottomLeftCy}
          r="190"
          fill="none"
          stroke="#0284c7"
          strokeOpacity="0.09"
          strokeWidth="1.25"
        />
        <circle
          cx={bottomLeftCx}
          cy={bottomLeftCy}
          r="140"
          fill="none"
          stroke="#6366f1"
          strokeOpacity="0.06"
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
              strokeOpacity="0.11"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          ))}

        {/* Delikatne łuki łączące */}
        <path
          d="M 120 100 Q 400 50 680 90"
          fill="none"
          stroke="#6366f1"
          strokeOpacity="0.05"
          strokeWidth="1"
        />
        <path
          d="M 40 680 Q 320 820 760 740"
          fill="none"
          stroke="#0284c7"
          strokeOpacity="0.05"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
