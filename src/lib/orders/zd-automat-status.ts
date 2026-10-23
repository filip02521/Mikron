/**
 * Zdanie stanu ekranu /zakupy/automat (Status Panel z DESIGN.md) i gotowość dostawcy do kolejnego
 * stopnia automatu (spec §4.4). Czyste funkcje — serwer i klient.
 */
import type { ZdKpiWeeklyMetrics } from "@/lib/data/zd-kpi-weekly";
import { polishPluralWord } from "@/lib/email/polish-plural";

/** Braki klasy A od tylu % dni-towarów to sygnał do reakcji (backtest: ~2–4% przy dobrej strategii). */
export const ZD_AUTOMAT_OOS_A_ALERT_PCT = 5;
/** Stopień 3 (auto-zatwierdzanie): korekta człowieka poniżej tylu % … */
export const ZD_AUTOMAT_READY_CORRECTION_PCT = 10;
/** … przez tyle kolejnych tygodni z ZD z propozycji. */
export const ZD_AUTOMAT_READY_WEEKS = 4;

export type ZdAutomatRow = {
  name: string;
  automat: { autoLevel: number; cycleDays: number | null } | null;
  /** Najnowszy tydzień pierwszy. */
  weeks: ZdKpiWeeklyMetrics[];
};

export type ZdAutomatReadiness =
  /** Stopień 3+ już ustawiony. */
  | { kind: "auto" }
  | { kind: "ready" }
  /** `weeksOk` kolejnych tygodni spełnia warunek (od najnowszego). */
  | { kind: "progress"; weeksOk: number }
  /** Najnowszy tydzień przerwał serię: korekta ≥ 10% albo brak ZD z propozycji. */
  | { kind: "not_yet"; reason: string };

export function zdAutomatReadiness(row: ZdAutomatRow): ZdAutomatReadiness | null {
  if (!row.automat) return null;
  if (row.automat.autoLevel >= 3) return { kind: "auto" };
  let ok = 0;
  for (const w of row.weeks) {
    const c = w.humanCorrection;
    if (!c.proposals || c.pct == null || c.pct >= ZD_AUTOMAT_READY_CORRECTION_PCT) break;
    ok++;
  }
  if (ok >= ZD_AUTOMAT_READY_WEEKS) return { kind: "ready" };
  if (ok > 0) return { kind: "progress", weeksOk: ok };
  const now = row.weeks[0]?.humanCorrection;
  if (!now || !now.proposals) return { kind: "not_yet", reason: "brak ZD z propozycji" };
  return { kind: "not_yet", reason: `korekta ${String(now.pct).replace(".", ",")}% ≥ ${ZD_AUTOMAT_READY_CORRECTION_PCT}%` };
}

export function zdAutomatOosAlert(row: ZdAutomatRow): boolean {
  const pct = row.weeks[0]?.oosA.pct;
  return row.automat != null && pct != null && pct >= ZD_AUTOMAT_OOS_A_ALERT_PCT;
}

export type ZdAutomatStatus = {
  tone: "success" | "warning" | "neutral";
  headline: string;
  detail: string;
};

const dostawc = (n: number) => polishPluralWord(n, "dostawca", "dostawcy", "dostawców");
/** Dopełniacz po „u”: u 1 dostawcy, u 2 / 5 dostawców. */
const uDostawc = (n: number) => (n === 1 ? "dostawcy" : "dostawców");
const list = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join(", ")} i ${names.length - 3} innych` : names.join(", "));

export function buildZdAutomatStatus(rows: readonly ZdAutomatRow[], kpiComputed: boolean): ZdAutomatStatus {
  const inAutomat = rows.filter((r) => r.automat);
  if (!inAutomat.length) {
    return {
      tone: "neutral",
      headline: "Żaden dostawca nie jest jeszcze w automacie",
      detail: "Włącz strategię propozycji w Kreatorze ZD (Strategia dostawcy); polscy dostawcy poniżej mają już pomiar rotacji i braków.",
    };
  }
  if (!kpiComputed) {
    return {
      tone: "neutral",
      headline: `${inAutomat.length} ${dostawc(inAutomat.length)} w automacie — KPI jeszcze nie policzone`,
      detail: "Pierwsze KPI policzą się w poniedziałek o 7:00 za miniony tydzień.",
    };
  }
  const alerts = inAutomat.filter(zdAutomatOosAlert).map((r) => r.name);
  // Bez historii stanów nie wiemy nic o brakach — nie piszemy „poniżej 5%”.
  const measured = inAutomat.filter((r) => r.weeks[0]?.oosA.pct != null).length;
  const ready = inAutomat.filter((r) => zdAutomatReadiness(r)?.kind === "ready").map((r) => r.name);
  const readyText = ready.length
    ? `Gotowi do auto-zatwierdzania (${ZD_AUTOMAT_READY_WEEKS} tygodnie z korektą poniżej ${ZD_AUTOMAT_READY_CORRECTION_PCT}%): ${list(ready)}.`
    : `Auto-zatwierdzanie po ${ZD_AUTOMAT_READY_WEEKS} tygodniach z korektą poniżej ${ZD_AUTOMAT_READY_CORRECTION_PCT}% — jeszcze nikt.`;
  if (alerts.length) {
    return {
      tone: "warning",
      headline: `${alerts.length} ${polishPluralWord(alerts.length, "dostawca ma", "dostawcy mają", "dostawców ma")} braki A od ${ZD_AUTOMAT_OOS_A_ALERT_PCT}%`,
      detail: `${list(alerts)} — sprawdź czas dostawy i zakres w Kreatorze. ${readyText}`,
    };
  }
  if (ready.length) {
    return {
      tone: "success",
      headline: `${ready.length} ${polishPluralWord(ready.length, "dostawca gotowy", "dostawcy gotowi", "dostawców gotowych")} do auto-zatwierdzania`,
      detail: `${list(ready)}. Braki A poniżej ${ZD_AUTOMAT_OOS_A_ALERT_PCT}% u ${measured} z ${inAutomat.length} w automacie.`,
    };
  }
  if (!measured) {
    return {
      tone: "neutral",
      headline: `${inAutomat.length} ${dostawc(inAutomat.length)} w automacie — braki A jeszcze bez pomiaru`,
      detail: `Braki liczą się z historii stanów nocnego przebiegu „Braki i zamówienia”; pierwszy tydzień z historią pokaże wynik. ${readyText}`,
    };
  }
  const unmeasured = inAutomat.length - measured;
  return {
    tone: "success",
    headline: `Automat bez alarmów: braki A poniżej ${ZD_AUTOMAT_OOS_A_ALERT_PCT}% u ${measured} ${uDostawc(measured)}`,
    detail: `${unmeasured ? `${unmeasured} bez pomiaru braków (brak historii stanów). ` : ""}${readyText}`,
  };
}
