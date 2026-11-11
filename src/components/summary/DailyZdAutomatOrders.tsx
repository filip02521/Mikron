"use client";

import { cn } from "@/lib/cn";
import {
  formatAutomatDay,
  warsawKeyFromIso,
  zdAutomatTodayStageStep,
  type ZdAutomatTodayOrder,
  type ZdAutomatTodayStage,
} from "@/lib/orders/zd-automat-daily";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" });

/** Te same trzy etapy co w panelu „Sprawdź i wyślij” — postęp widać bez otwierania. */
const STEPS = ["Sprawdzenie", "ZD w Subiekcie", "Mail do dostawcy"] as const;

export function zdAutomatStageText(
  o: ZdAutomatTodayOrder,
  todayKey: string,
  /** Dzień następnej propozycji dostawcy — wtedy ta wygasa. */
  expiresKey: string | null
): { text: string; tone: "neutral" | "warning" | "success" } {
  const nr = o.proposal.dokNr ?? "ZD";
  switch (o.stage) {
    case "review": {
      const day = warsawKeyFromIso(o.proposal.createdAt);
      const text = [
        day === todayKey ? "do sprawdzenia" : `do sprawdzenia, czeka od ${formatAutomatDay(day, todayKey)}`,
        expiresKey && expiresKey > todayKey ? `wygasa ${formatAutomatDay(expiresKey, todayKey)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return { text, tone: "neutral" };
    }
    case "unconfirmed":
      return { text: "Subiekt nie potwierdził zapisu ZD - sprawdź w Subiekcie, zanim zamówisz ponownie", tone: "warning" };
    case "send":
      return { text: `${nr} w Subiekcie · zamówienie jeszcze nie wysłane do dostawcy`, tone: "warning" };
    case "sent":
      return { text: `${nr} · wysłane do dostawcy ${timeOf(o.proposal.mailSentAt!)}`, tone: "success" };
    case "rejected":
      return { text: "odrzucona", tone: "neutral" };
  }
}

export function ZdAutomatStageBar({ stage }: { stage: ZdAutomatTodayStage }) {
  const done = zdAutomatTodayStageStep(stage);
  const closed = stage === "rejected";
  return (
    <span
      className="grid w-full grid-cols-3 gap-1 sm:w-32"
      role="img"
      aria-label={closed ? "Odrzucona" : `Etap ${Math.min(done + 1, 3)} z 3: ${STEPS[Math.min(done, 2)]}${done === 3 ? " - gotowe" : ""}`}
    >
      {STEPS.map((label, i) => (
        <span
          key={label}
          title={label}
          className={cn(
            "h-1 rounded-full transition-colors duration-300 motion-reduce:transition-none",
            closed ? "bg-slate-200" : i < done ? "bg-indigo-600" : i === done ? "bg-indigo-300" : "bg-slate-200"
          )}
        />
      ))}
    </span>
  );
}
