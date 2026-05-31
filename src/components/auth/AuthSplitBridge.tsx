/** Most wizualny między ciemnym a jasnym panelem logowania (wariant falisty). */

import { authTickLines } from "@/components/auth/auth-background-geometry";

/**
 * Tarcza „wchodząca” z lewego panelu na jasną stronę + miękka fala na styku.
 * Zakotwiczona przy prawej krawędzi aside (`-right-*`).
 */
export function AuthSplitBridge() {
  const cx = 140;
  const cy = 140;
  const ticks = authTickLines(cx, cy, 118, 0.88);

  return (
    <div
      className="pointer-events-none absolute -right-36 top-[38%] z-20 hidden w-72 -translate-y-1/2 lg:block xl:-right-40 xl:w-80"
      aria-hidden
    >
      <svg viewBox="0 0 280 280" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="auth-bridge-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#312e81" stopOpacity="0.18" />
            <stop offset="45%" stopColor="#6366f1" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="auth-bridge-hand-dark" x1="0" y1="0" x2="0" y2="-1">
            <stop offset="0%" stopColor="#e0e7ff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="auth-bridge-hand-light" x1="0" y1="0" x2="0" y2="-1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.18" />
          </linearGradient>
          <clipPath id="auth-bridge-left-half">
            <rect x="0" y="0" width="140" height="280" />
          </clipPath>
          <clipPath id="auth-bridge-right-half">
            <rect x="140" y="0" width="140" height="280" />
          </clipPath>
        </defs>

        {/* Miękki gradient na styku paneli */}
        <ellipse cx="138" cy="140" rx="150" ry="130" fill="url(#auth-bridge-fade)" />

        {/* Fala na styku paneli */}
        <path
          d="M 146 8 C 112 78, 172 142, 138 212 C 104 282, 158 272, 146 8"
          fill="#312e81"
          fillOpacity="0.06"
        />
        <path
          d="M 146 24 C 118 92, 160 148, 138 212 C 116 276, 152 256, 146 24"
          fill="none"
          stroke="#6366f1"
          strokeOpacity="0.14"
          strokeWidth="1.25"
        />

        {/* Lewa połowa tarczy — ciemny panel */}
        <g clipPath="url(#auth-bridge-left-half)">
          <circle
            cx={cx}
            cy={cy}
            r="125"
            fill="none"
            stroke="white"
            strokeOpacity="0.14"
            strokeWidth="1.25"
          />
          <circle
            cx={cx}
            cy={cy}
            r="95"
            fill="none"
            stroke="white"
            strokeOpacity="0.1"
            strokeWidth="1"
          />
          {ticks.map((tick, i) => (
            <line
              key={`bl-${i}`}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke="white"
              strokeOpacity={tick.major ? 0.28 : 0.14}
              strokeWidth={tick.major ? 1.5 : 1}
              strokeLinecap="round"
            />
          ))}
          <g transform={`translate(${cx} ${cy})`} stroke="url(#auth-bridge-hand-dark)" strokeLinecap="round">
            <line x1="0" y1="0" x2="0" y2="-48" strokeWidth="2.5" transform="rotate(-60)" />
            <line x1="0" y1="0" x2="0" y2="-68" strokeWidth="1.75" transform="rotate(30)" />
          </g>
        </g>

        {/* Prawa połowa — jasny panel */}
        <g clipPath="url(#auth-bridge-right-half)">
          <circle
            cx={cx}
            cy={cy}
            r="125"
            fill="none"
            stroke="#6366f1"
            strokeOpacity="0.12"
            strokeWidth="1.25"
          />
          <circle
            cx={cx}
            cy={cy}
            r="95"
            fill="none"
            stroke="#0284c7"
            strokeOpacity="0.09"
            strokeWidth="1"
          />
          {ticks.map((tick, i) => (
            <line
              key={`br-${i}`}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke="#6366f1"
              strokeOpacity={tick.major ? 0.16 : 0.08}
              strokeWidth={tick.major ? 1.5 : 1}
              strokeLinecap="round"
            />
          ))}
          <g transform={`translate(${cx} ${cy})`} stroke="url(#auth-bridge-hand-light)" strokeLinecap="round">
            <line x1="0" y1="0" x2="0" y2="-48" strokeWidth="2.5" transform="rotate(-60)" />
            <line x1="0" y1="0" x2="0" y2="-68" strokeWidth="1.75" transform="rotate(30)" />
          </g>
        </g>

        <circle cx={cx} cy={cy} r="4" fill="#6366f1" fillOpacity="0.2" />
      </svg>
    </div>
  );
}

/** Delikatne „przejście” koloru na jasnej stronie od mostu. */
export function AuthMainBridgeFade() {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-0 z-[1] hidden w-40 bg-gradient-to-r from-indigo-200/25 via-indigo-100/10 to-transparent lg:block xl:w-48"
      aria-hidden
    />
  );
}
