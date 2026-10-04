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

      <g transform={`translate(${cx} ${cy})`}>
        {/* Smuga sekundnika: krótki łuk na obwodzie, obiega tarczę raz na 40 s. */}
        <circle
          className="auth-dial-sweep"
          r="260"
          fill="none"
          stroke="#aadbe0"
          strokeOpacity="0.45"
          strokeWidth="2"
          strokeDasharray="72 1562"
          strokeLinecap="round"
        />
        <circle
          className="auth-dial-orbit"
          r="290"
          fill="none"
          stroke="white"
          strokeOpacity="0.16"
          strokeWidth="1"
          strokeDasharray="2 14"
          strokeLinecap="round"
        />
        <g stroke="#d4edef" strokeLinecap="round">
          <g className="auth-dial-hand auth-dial-hand--hour">
            <line x1="0" y1="0" x2="0" y2="-115" strokeWidth="3" opacity="0.45" transform="rotate(-60)" />
          </g>
          <g className="auth-dial-hand auth-dial-hand--minute">
            <line x1="0" y1="0" x2="0" y2="-165" strokeWidth="2" opacity="0.38" transform="rotate(30)" />
          </g>
          <circle r="5" fill="white" fillOpacity="0.2" />
        </g>
      </g>


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


  return (
    <>

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
        viewBox="0 0 800 900"
        preserveAspectRatio="xMidYMid slice"
      >

        {/* Prawy górny róg */}
        <circle
          cx={topRightCx}
          cy={topRightCy}
          r="280"
          fill="none"
          stroke="#188995"
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
        <g transform={`translate(${topRightCx} ${topRightCy})`}>
          <circle
            r="245"
            fill="none"
            stroke="#188995"
            strokeOpacity="0.12"
            strokeWidth="1"
            strokeDasharray="2 16"
            strokeLinecap="round"
          />
        </g>
        {topRightTicks.map((tick, i) => (
          <line
            key={`tr-${i}`}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="#188995"
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
        stroke="#188995"
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
            stroke="#188995"
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
