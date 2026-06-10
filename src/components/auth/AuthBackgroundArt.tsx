/** Dekoracyjna geometria tła ekranów auth — nawiązanie do tarczy OnTime. */

import { authTickLines } from "@/components/auth/auth-background-geometry";

/** Ciemny panel boczny — pełna tarcza (wariant 1). */
export function AuthAsideBackdrop() {
  const cx = 80;
  const cy = 620;
  const ticks = authTickLines(cx, cy, 300, 0.88);

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
      viewBox="0 0 448 900"
      preserveAspectRatio="xMidYMid slice"
    >
      <circle cx={cx} cy={cy} r="320" fill="none" stroke="white" strokeOpacity="0.05" strokeWidth="1" />
      <circle cx={cx} cy={cy} r="260" fill="none" stroke="white" strokeOpacity="0.07" strokeWidth="1" />
      <circle cx={cx} cy={cy} r="200" fill="none" stroke="white" strokeOpacity="0.04" strokeWidth="1" />

      {ticks.map((tick, i) => (
        <line
          key={i}
          x1={tick.x1}
          y1={tick.y1}
          x2={tick.x2}
          y2={tick.y2}
          stroke="white"
          strokeOpacity={tick.major ? 0.22 : 0.1}
          strokeWidth={tick.major ? 1.5 : 1}
          strokeLinecap="round"
        />
      ))}

      <g transform={`translate(${cx} ${cy})`} stroke="url(#auth-aside-hand)" strokeLinecap="round">
        <line x1="0" y1="0" x2="0" y2="-115" strokeWidth="3" opacity="0.35" transform="rotate(-60)" />
        <line x1="0" y1="0" x2="0" y2="-165" strokeWidth="2" opacity="0.28" transform="rotate(30)" />
        <circle r="5" fill="white" fillOpacity="0.2" />
      </g>

      <defs>
        <linearGradient id="auth-aside-hand" x1="0" y1="0" x2="0" y2="-1">
          <stop offset="0%" stopColor="#e0e7ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.5" />
        </linearGradient>
      </defs>

      <path
        d="M 380 -20 A 180 180 0 0 0 520 120"
        fill="none"
        stroke="#7dd3fc"
        strokeOpacity="0.12"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** Ciemny panel — uproszczona tarcza (wariant 2). */
export function AuthAsideBackdropMinimal() {
  const cx = 90;
  const cy = 640;
  const ticks = authTickLines(cx, cy, 280, 0.9, 3);

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
      viewBox="0 0 448 900"
      preserveAspectRatio="xMidYMid slice"
    >
      <circle cx={cx} cy={cy} r="290" fill="none" stroke="white" strokeOpacity="0.07" strokeWidth="1" />
      {ticks
        .filter((tick) => tick.major)
        .map((tick, i) => (
          <line
            key={i}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="white"
            strokeOpacity="0.18"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ))}
      <g transform={`translate(${cx} ${cy})`} stroke="white" strokeLinecap="round" strokeOpacity="0.3">
        <line x1="0" y1="0" x2="0" y2="-105" strokeWidth="2.5" transform="rotate(-60)" />
        <line x1="0" y1="0" x2="0" y2="-150" strokeWidth="1.75" transform="rotate(30)" />
      </g>
    </svg>
  );
}

/** Jasna strona — wariant 1: blur + wielowarstwowa geometria. */
export function AuthMainBackdropRich() {
  const topRightCx = 680;
  const topRightCy = 40;
  const topRightTicks = authTickLines(topRightCx, topRightCy, 260, 0.9);

  const bottomLeftCx = 120;
  const bottomLeftCy = 820;
  const bottomLeftTicks = authTickLines(bottomLeftCx, bottomLeftCy, 160, 0.88);

  const centerCx = 420;
  const centerCy = 460;
  const centerTicks = authTickLines(centerCx, centerCy, 180, 0.9, 4);

  return (
    <>
      <div
        className="pointer-events-none absolute -right-24 top-[8%] h-[min(28rem,55vw)] w-[min(28rem,55vw)] rounded-full bg-indigo-200/50 blur-3xl motion-safe:animate-auth-float"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-20 bottom-[10%] h-72 w-72 rounded-full bg-sky-200/45 blur-3xl motion-safe:animate-auth-float-slow motion-safe:[animation-delay:1.4s]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[42%] h-56 w-56 rounded-full bg-indigo-100/35 blur-2xl motion-safe:animate-auth-float-center motion-safe:[animation-delay:2.8s]"
        aria-hidden
      />

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
        viewBox="0 0 800 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="auth-main-glow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#e0e7ff" stopOpacity="0.35" />
            <stop offset="55%" stopColor="#f0f9ff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="auth-main-hand" x1="0" y1="0" x2="0" y2="-1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.12" />
          </linearGradient>
        </defs>

        <rect width="800" height="900" fill="url(#auth-main-glow)" />

        {/* Tarcza za formularzem — centrum ekranu */}
        <circle
          cx={centerCx}
          cy={centerCy}
          r="195"
          fill="none"
          stroke="#6366f1"
          strokeOpacity="0.09"
          strokeWidth="1.25"
        />
        <circle
          cx={centerCx}
          cy={centerCy}
          r="145"
          fill="none"
          stroke="#0284c7"
          strokeOpacity="0.07"
          strokeWidth="1"
        />
        {centerTicks.map((tick, i) => (
          <line
            key={`c-${i}`}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="#6366f1"
            strokeOpacity={tick.major ? 0.14 : 0.07}
            strokeWidth={tick.major ? 1.5 : 1}
            strokeLinecap="round"
          />
        ))}
        <g
          transform={`translate(${centerCx} ${centerCy})`}
          stroke="url(#auth-main-hand)"
          strokeLinecap="round"
        >
          <line x1="0" y1="0" x2="0" y2="-72" strokeWidth="2.5" transform="rotate(-60)" />
          <line x1="0" y1="0" x2="0" y2="-105" strokeWidth="1.75" transform="rotate(30)" />
          <circle r="4" fill="#6366f1" fillOpacity="0.12" />
        </g>

        {/* Prawy górny róg */}
        <circle
          cx={topRightCx}
          cy={topRightCy}
          r="280"
          fill="none"
          stroke="#6366f1"
          strokeOpacity="0.08"
          strokeWidth="1.25"
        />
        <circle
          cx={topRightCx}
          cy={topRightCy}
          r="210"
          fill="none"
          stroke="#0284c7"
          strokeOpacity="0.06"
          strokeWidth="1"
        />
        {topRightTicks.map((tick, i) => (
          <line
            key={`tr-${i}`}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="#6366f1"
            strokeOpacity={tick.major ? 0.12 : 0.06}
            strokeWidth={tick.major ? 1.5 : 1}
            strokeLinecap="round"
          />
        ))}

        {/* Lewy dolny róg */}
        <circle
          cx={bottomLeftCx}
          cy={bottomLeftCy}
          r="220"
          fill="none"
          stroke="#0284c7"
          strokeOpacity="0.08"
          strokeWidth="1.25"
        />
        {bottomLeftTicks.map((tick, i) => (
          <line
            key={`bl-${i}`}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="#0284c7"
            strokeOpacity={tick.major ? 0.11 : 0.055}
            strokeWidth={tick.major ? 1.5 : 1}
            strokeLinecap="round"
          />
        ))}

        {/* Delikatne łuki łączące kompozycję */}
        <path
          d="M 120 120 Q 400 40 680 100"
          fill="none"
          stroke="#6366f1"
          strokeOpacity="0.05"
          strokeWidth="1"
        />
        <path
          d="M 40 680 Q 320 820 760 760"
          fill="none"
          stroke="#0284c7"
          strokeOpacity="0.05"
          strokeWidth="1"
        />

        {/* Siatka punktów */}
        {Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: 8 }).map((__, col) => (
            <circle
              key={`${row}-${col}`}
              cx={48 + col * 92}
              cy={48 + row * 140}
              r="1.25"
              fill="#6366f1"
              fillOpacity={0.045 + (col % 2) * 0.015}
            />
          ))
        )}
      </svg>
    </>
  );
}

/** Jasna strona — wariant 2: tarcze w rogach, środek wolny pod formularz. */
export function AuthMainBackdropGeometric() {
  const topRightCx = 720;
  const topRightCy = -30;
  const topRightTicks = authTickLines(topRightCx, topRightCy, 220, 0.9, 3);

  const bottomLeftCx = -40;
  const bottomLeftCy = 880;
  const bottomLeftTicks = authTickLines(bottomLeftCx, bottomLeftCy, 200, 0.9, 3);

  return (
    <>
      <div
        className="pointer-events-none absolute -right-16 top-[12%] h-48 w-48 rounded-full bg-indigo-200/35 blur-3xl motion-safe:animate-auth-float"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-12 bottom-[14%] h-40 w-40 rounded-full bg-sky-200/30 blur-3xl motion-safe:animate-auth-float-slow motion-safe:[animation-delay:1.6s]"
        aria-hidden
      />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
        viewBox="0 0 800 900"
        preserveAspectRatio="xMidYMid slice"
      >
      {/* Prawy górny róg — widać tylko wycinek tarczy */}
      <circle
        cx={topRightCx}
        cy={topRightCy}
        r="240"
        fill="none"
        stroke="#6366f1"
        strokeOpacity="0.08"
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
            strokeOpacity="0.11"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        ))}

      {/* Lewy dolny — echo od ciemnego panelu, poza kartą logowania */}
      <circle
        cx={bottomLeftCx}
        cy={bottomLeftCy}
        r="210"
        fill="none"
        stroke="#0284c7"
        strokeOpacity="0.07"
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
            strokeOpacity="0.09"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        ))}
    </svg>
    </>
  );
}

/** Mini tarcza na kompaktowym panelu cytatu (mobile). */
export function AuthCompactQuoteBackdrop() {
  const cx = 280;
  const cy = 80;
  const ticks = authTickLines(cx, cy, 95, 0.86);

  return (
    <svg
      className="pointer-events-none absolute -right-6 -top-6 h-44 w-44"
      aria-hidden
      viewBox="0 0 200 160"
    >
      <circle cx={cx} cy={cy} r="88" fill="none" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
      {ticks.map((tick, i) => (
        <line
          key={i}
          x1={tick.x1}
          y1={tick.y1}
          x2={tick.x2}
          y2={tick.y2}
          stroke="white"
          strokeOpacity={tick.major ? 0.35 : 0.15}
          strokeWidth={tick.major ? 1.25 : 1}
          strokeLinecap="round"
        />
      ))}
      <g transform={`translate(${cx} ${cy})`} stroke="white" strokeLinecap="round">
        <line x1="0" y1="0" x2="0" y2="-42" strokeWidth="2" opacity="0.35" transform="rotate(-60)" />
        <line x1="0" y1="0" x2="0" y2="-58" strokeWidth="1.5" opacity="0.28" transform="rotate(30)" />
      </g>
    </svg>
  );
}
