/**
 * Zdanie stanu ekranu /zakupy/automat (Status Panel z DESIGN.md) i gotowość dostawcy do kolejnego
 * stopnia automatu (spec §4.4). Czyste funkcje — serwer i klient.
 */
import type { ZdKpiWeeklyMetrics } from "@/lib/data/zd-kpi-weekly";
import { polishPluralWord } from "@/lib/email/polish-plural";
import type { ZdBacktestVerdictKind } from "@/lib/orders/zd-backtest";

/** Braki klasy A od tylu % dni-towarów to sygnał do reakcji (backtest: ~2–4% przy dobrej strategii). */
export const ZD_AUTOMAT_OOS_A_ALERT_PCT = 5;
/** Stopień 3 (auto-zatwierdzanie): korekta człowieka poniżej tylu % … */
export const ZD_AUTOMAT_READY_CORRECTION_PCT = 10;
/** … przez tyle kolejnych tygodni z ZD z propozycji. */
export const ZD_AUTOMAT_READY_WEEKS = 4;

/** Backtest starszy niż tyle dni nie opisuje już bieżącej sprzedaży — dostawca trafia do „Do sprawdzenia”. */
export const ZD_AUTOMAT_BACKTEST_STALE_DAYS = 90;

/** Pełne dni od przebiegu backtestu. */
export function zdBacktestAgeDays(at: string, nowMs = Date.now()): number {
  return Math.floor((nowMs - new Date(at).getTime()) / 86_400_000);
}

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

/** Najniższy stopień, do którego cofa automat — 1 = propozycje zatwierdza człowiek (0 wyłączyłby propozycje). */
export const ZD_AUTOMAT_ROLLBACK_FLOOR = 1;

/**
 * Cofnięcie stopnia po brakach A (spec §4.4): tydzień z brakami A od ZD_AUTOMAT_OOS_A_ALERT_PCT przy stopniu ≥ 2
 * obniża stopień o jeden, najniżej do 1. Kolejny tydzień z alarmem — o kolejny. null = bez zmiany.
 */
export function zdAutomatLevelRollback(input: {
  autoLevel: number;
  oosAPct: number | null;
  weekStart: string;
}): { from: number; to: number; reason: string } | null {
  const pct = input.oosAPct;
  if (pct == null || pct < ZD_AUTOMAT_OOS_A_ALERT_PCT) return null;
  if (!(input.autoLevel > ZD_AUTOMAT_ROLLBACK_FLOOR)) return null;
  const to = Math.max(ZD_AUTOMAT_ROLLBACK_FLOOR, input.autoLevel - 1);
  const [, m, d] = input.weekStart.split("-");
  return {
    from: input.autoLevel,
    to,
    reason: `braki A ${String(pct).replace(".", ",")}% w tygodniu od ${d}.${m} (próg ${ZD_AUTOMAT_OOS_A_ALERT_PCT}%)`,
  };
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
      detail: "Włącz automat w karcie dostawcy albo rozwiń dostawcę w tabeli poniżej (Włącz automat); polscy dostawcy mają już pomiar rotacji i braków.",
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

export const ZD_BACKTEST_VERDICT_LABEL: Record<ZdBacktestVerdictKind, string> = {
  works: "działa",
  tradeoff: "kompromis",
  fails: "nie działa",
  insufficient: "za mało danych",
};

export type ZdAutomatCheckInput = {
  name: string;
  inAutomat: boolean;
  /** Nocny przebieg robi propozycje tylko dla aktywnych dostawców z zakresem w Kreatorze. Brak = oba spełnione. */
  active?: boolean;
  hasScope?: boolean;
  /** Bieżące ustawienia automatu — backtest liczony dla innych nie potwierdza tych. */
  policy?: { cycleDays: number | null; targetDays: number | null };
  backtest: {
    status: "queued" | "running" | "done" | "error";
    verdict: ZdBacktestVerdictKind | null;
    at: string;
    params?: { cycleDays: number; targetDays: number };
  } | null;
  oosAlert: boolean;
};

/**
 * Powody, dla których dostawca w automacie jest „do sprawdzenia”: automat stoi (dostawca nieaktywny albo bez zakresu
 * w Kreatorze), alarm braków A, brak lub błąd backtestu, werdykt inny niż „działa”, backtest dla innych ustawień niż
 * bieżące, backtest starszy niż 90 dni (ZD_AUTOMAT_BACKTEST_STALE_DAYS). Liczący się backtest — bez powodu (wynik
 * w drodze). Dostawca poza automatem — nigdy.
 */
export function zdAutomatCheckReasons(row: ZdAutomatCheckInput, nowMs = Date.now()): string[] {
  if (!row.inAutomat) return [];
  const out: string[] = [];
  if (row.active === false) out.push("nieaktywny w karcie - automat stoi");
  else if (row.hasScope === false) out.push("bez zakresu w Kreatorze - automat stoi");
  if (row.oosAlert) out.push(`braki A od ${ZD_AUTOMAT_OOS_A_ALERT_PCT}%`);
  const b = row.backtest;
  if (!b) out.push("brak backtestu");
  else if (b.status === "error") out.push("błąd backtestu");
  else if (b.status === "done") {
    if (b.verdict && b.verdict !== "works") out.push(`backtest „${ZD_BACKTEST_VERDICT_LABEL[b.verdict]}”`);
    const p = b.params;
    if (p && row.policy && (p.cycleDays !== row.policy.cycleDays || p.targetDays !== row.policy.targetDays)) {
      out.push(`backtest dla innych ustawień (co ${p.cycleDays} / cel ${p.targetDays})`);
    }
    const age = zdBacktestAgeDays(b.at, nowMs);
    if (age > ZD_AUTOMAT_BACKTEST_STALE_DAYS) out.push(`backtest sprzed ${age} dni`);
  }
  return out;
}

/** Zdanie stanu pulpitu, gdy ktoś w automacie jest do sprawdzenia; null = brak takich (zdanie z KPI). */
export function buildZdAutomatCheckStatus(
  rows: readonly ZdAutomatCheckInput[],
  nowMs = Date.now()
): (ZdAutomatStatus & { count: number }) | null {
  const inAutomat = rows.filter((r) => r.inAutomat);
  const flagged = inAutomat
    .map((r) => ({ name: r.name, reasons: zdAutomatCheckReasons(r, nowMs) }))
    .filter((r) => r.reasons.length);
  if (!flagged.length) return null;
  const shown = flagged.slice(0, 3).map((r) => `${r.name}: ${r.reasons.join(", ")}`);
  const rest = flagged.length - shown.length;
  return {
    tone: "warning",
    count: flagged.length,
    headline: `${flagged.length} z ${inAutomat.length} ${uDostawc(inAutomat.length)} w automacie do sprawdzenia`,
    detail: `${shown.join(" · ")}${rest ? ` · i ${rest} ${polishPluralWord(rest, "inny", "inni", "innych")}` : ""}.`,
  };
}
