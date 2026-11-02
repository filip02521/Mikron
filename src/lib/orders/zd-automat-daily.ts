/**
 * Sekcja „Automat ZD” w panelu dziennym: kiedy kolejna propozycja, co z ostatnią, czy automat stoi i czy nocny
 * przebieg poszedł. Czyste funkcje — serwer i klient. Termin liczony tak jak w workerze (`isZdAutoProposalDue`):
 * od ostatniej propozycji (dowolny status) minęło `cycleDays` dni, a propozycja powstaje w nocnym przebiegu.
 */
import { polishPluralWord } from "@/lib/email/polish-plural";
import { isBusinessDay } from "@/lib/orders/business-calendar";

export type ZdAutomatDailyProposalStatus = "pending" | "accepted" | "rejected" | "expired" | "deferred";

export type ZdAutomatDailyProposal = {
  id: string;
  createdAt: string;
  status: ZdAutomatDailyProposalStatus;
  lineCount: number;
  valueNet: number;
  /** Numer ZD utworzonego z propozycji (zatwierdzona). */
  dokNr: string | null;
  /** Skąd propozycja (migracja 199); null = nocna albo sprzed migracji. */
  origin?: "night" | "manual" | "review" | null;
  /** Tworzenie ZD rozpoczęte, bez potwierdzenia z Subiekta (timeout) — czeka na uzgodnienie. */
  createAttemptedAt?: string | null;
  /** Utworzone ZD (dok_Id) — wysyłka maila z panelu. */
  dokId?: number | null;
  /** Kiedy zatwierdzona albo odrzucona. */
  decidedAt?: string | null;
  /** Ostatni mail z tym ZD do dostawcy wysłany z OnTime; null = nie wysłany (albo wysłany poza OnTime). */
  mailSentAt?: string | null;
};

/**
 * Kotwica cyklu: najnowsza nocna (albo sprzed migracji 199) lub zatwierdzona — jak worker
 * (`fetchZdAutoProposalCycleAnchorKey`). Przeliczenie w panelu ani niezatwierdzone „Przygotuj teraz” jej nie przesuwa.
 */
export function zdAutomatCycleAnchor(proposals: readonly ZdAutomatDailyProposal[]): ZdAutomatDailyProposal | undefined {
  return proposals.find((p) => p.origin == null || p.origin === "night" || p.status === "accepted");
}

/** Wynik ostatniej próby propozycji (nocny przebieg albo „Przygotuj teraz”) — `ZdAutoProposalOutcome` z workera. */
export type ZdAutomatDailyAttemptKind = "created" | "nothing_to_order" | "not_due" | "disabled" | "skipped" | "error";

export type ZdAutomatDailyAttempt = { at: string; kind: ZdAutomatDailyAttemptKind; detail: string | null };

export type ZdAutomatDailySupplier = {
  id: string;
  name: string;
  isActive: boolean;
  hasScope: boolean;
  autoProposals: boolean;
  cycleDays: number | null;
  /** Najnowsza pierwsza, najwyżej kilka ostatnich. */
  proposals: ZdAutomatDailyProposal[];
  lastAttempt: ZdAutomatDailyAttempt | null;
  /** Stopień cofnięty automatycznie przez braki A (do następnej ręcznej zmiany ustawień). */
  levelRollback?: { at: string; reason: string } | null;
};

export type ZdAutomatDailyRun = {
  runDate: string;
  status: "running" | "ok" | "partial" | "failed";
  startedAt: string;
  finishedAt: string | null;
};

export type ZdAutomatDailyData = { suppliers: ZdAutomatDailySupplier[]; run: ZdAutomatDailyRun | null };

/** Nocny przebieg „Braki i zamówienia” rusza 05:30–06:30 (cron) — propozycje są zwykle przed 7:00. */
export const ZD_AUTOMAT_NIGHT_RUN_TIME = "ok. 6:00";
/** Po tej godzinie (Warszawa) brak dzisiejszego przebiegu to awaria, nie „jeszcze nie ruszył”. */
export const ZD_AUTOMAT_NIGHT_RUN_LATE_MINUTES = 7 * 60 + 30;

const DAY_MS = 86_400_000;
const WEEKDAY = ["nd", "pn", "wt", "śr", "czw", "pt", "sob"] as const;

export function addDaysToKey(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetweenKeys(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** „dziś”, „jutro”, „wczoraj”, „pt 31.10”. */
export function formatAutomatDay(key: string, todayKey: string): string {
  const diff = daysBetweenKeys(todayKey, key);
  if (diff === 0) return "dziś";
  if (diff === 1) return "jutro";
  if (diff === -1) return "wczoraj";
  const d = new Date(`${key}T00:00:00Z`);
  return `${WEEKDAY[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Automat pracuje w dni robocze (pn–pt bez polskich świąt): w weekend i święto nocny przebieg nie robi propozycji. */
export function isZdAutomatWorkday(key: string): boolean {
  return isBusinessDay(new Date(`${key}T00:00:00`));
}

/** Najbliższy dzień roboczy od `key` włącznie. */
export function nextZdAutomatWorkdayKey(key: string): string {
  let k = key;
  for (let i = 0; i < 14 && !isZdAutomatWorkday(k); i++) k = addDaysToKey(k, 1);
  return k;
}

/** Klucz dnia (Warszawa) z ISO — pierwsze 10 znaków po przesunięciu do Europe/Warsaw. */
export function warsawKeyFromIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso)
  );
}

/**
 * Lista propozycji policzona dziś (nocny przebieg albo przeliczenie) — panel „Sprawdź i wyślij” pokazuje ją od razu,
 * bez liczenia od nowa. Starsza (wczoraj i wcześniej) przelicza się przy otwarciu: stany są już inne.
 */
export function zdProposalListFromToday(p: { createdAt: string; refreshedAt?: string | null }, todayKey: string): boolean {
  return warsawKeyFromIso(p.refreshedAt ?? p.createdAt) === todayKey;
}

export type ZdAutomatNightRunState =
  | { kind: "done"; at: string; failed: boolean; partial: boolean }
  | { kind: "running"; since: string }
  /** Dziś jeszcze nie było, ale to normalne (przed ~7:30). */
  | { kind: "not_yet" }
  /** Po ~7:30 nie było dzisiejszego przebiegu — propozycje dziś nie powstaną. */
  | { kind: "missing"; lastRunDate: string | null };

export function zdAutomatNightRunState(run: ZdAutomatDailyRun | null, todayKey: string, nowMinutes: number): ZdAutomatNightRunState {
  if (run && run.runDate === todayKey) {
    if (run.status === "running") return { kind: "running", since: run.startedAt };
    return { kind: "done", at: run.finishedAt ?? run.startedAt, failed: run.status === "failed", partial: run.status === "partial" };
  }
  if (nowMinutes < ZD_AUTOMAT_NIGHT_RUN_LATE_MINUTES) return { kind: "not_yet" };
  return { kind: "missing", lastRunDate: run?.runDate ?? null };
}

/** Dzisiejszej nocy już nie będzie: przeszła albo jej nie było (po ~7:30). Trwająca — jeszcze może coś zrobić. */
export function zdAutomatNightPassed(night: ZdAutomatNightRunState): boolean {
  return night.kind === "done" || night.kind === "missing";
}

/** Powód, dla którego automat dostawcy nic nie przygotuje (jak `zdAutomatCheckReasons` + ustawienia propozycji). */
export function zdAutomatStopReason(s: ZdAutomatDailySupplier): string | null {
  if (!s.isActive) return "dostawca nieaktywny w karcie";
  if (!s.hasScope) return "brak zakresu w Kreatorze ZD";
  if (!s.autoProposals) return "propozycje wyłączone w ustawieniach automatu";
  if (!(s.cycleDays != null && s.cycleDays >= 1)) return "brak cyklu w ustawieniach automatu";
  return null;
}

/**
 * Dzień, w którym automat najwcześniej zrobi kolejną propozycję. Przy terminie już minionym — najbliższy nocny
 * przebieg: dziś, gdy dzisiejszy jeszcze przed nami albo trwa; jutro, gdy przeszedł albo go dziś nie było
 * (`nightPassed`). Tylko dni robocze — termin w weekend lub święto przechodzi na najbliższy roboczy.
 * Propozycja powstaje tylko, gdy jest co zamówić.
 */
export function zdAutomatNextProposalKey(
  s: ZdAutomatDailySupplier,
  ctx: { todayKey: string; nightPassed: boolean }
): string | null {
  if (zdAutomatStopReason(s)) return null;
  const last = zdAutomatCycleAnchor(s.proposals);
  const firstPossible = ctx.nightPassed ? addDaysToKey(ctx.todayKey, 1) : ctx.todayKey;
  if (!last) return nextZdAutomatWorkdayKey(firstPossible);
  const due = addDaysToKey(warsawKeyFromIso(last.createdAt), s.cycleDays!);
  return nextZdAutomatWorkdayKey(due > firstPossible ? due : firstPossible);
}

export type ZdAutomatSupplierView = {
  stopReason: string | null;
  nextKey: string | null;
  pending: ZdAutomatDailyProposal | null;
  /** Ostatnia próba dziś zakończona błędem albo zablokowana — powód z workera; albo dziś termin, a próby nie było. */
  attemptProblem: string | null;
  /** Dzisiejsza próba bez propozycji i bez błędu — czemu „jutro”, a nie dziś. */
  attemptNote: string | null;
};

const ATTEMPT_NOTE: Partial<Record<ZdAutomatDailyAttemptKind, string>> = {
  nothing_to_order: "dziś: nic do zamówienia",
  not_due: "dziś: przed terminem cyklu",
  disabled: "dziś: propozycje wyłączone",
};

export function zdAutomatSupplierView(
  s: ZdAutomatDailySupplier,
  ctx: { todayKey: string; nightPassed: boolean }
): ZdAutomatSupplierView {
  const a = s.lastAttempt;
  const attemptToday = a && warsawKeyFromIso(a.at) === ctx.todayKey;
  const stopReason = zdAutomatStopReason(s);
  // Każde policzenie dostawcy w nocnym przebiegu zapisuje wynik próby — brak dzisiejszego przy terminie na dziś
  // znaczy, że przebieg dostawcy nie policzył (inaczej wiersz pokazywałby tylko „jutro”).
  const missed =
    !stopReason && !attemptToday && ctx.nightPassed && zdAutomatNextProposalKey(s, { ...ctx, nightPassed: false }) === ctx.todayKey;
  const attemptProblem =
    attemptToday && (a.kind === "error" || a.kind === "skipped")
      ? `${a.kind === "error" ? "błąd" : "wstrzymane"}: ${a.detail?.trim() || "bez opisu"}`
      : missed
        ? "dziś termin, a nocny przebieg nie policzył dostawcy"
        : null;
  return {
    stopReason,
    nextKey: zdAutomatNextProposalKey(s, ctx),
    pending: s.proposals[0]?.status === "pending" ? s.proposals[0] : null,
    attemptProblem,
    attemptNote: attemptToday && !attemptProblem ? (ATTEMPT_NOTE[a.kind] ?? null) : null,
  };
}

/**
 * Cykle do paska „Ostatnie cykle”: jedna propozycja na dzień (najnowsza z dnia). Kilka „Przygotuj teraz” jednego
 * dnia wygasza poprzednie — to nie są cykle „wygasłe bez decyzji”, tylko zastąpione tego samego dnia.
 */
export function zdAutomatCycles(proposals: readonly ZdAutomatDailyProposal[], limit = 8): ZdAutomatDailyProposal[] {
  const seen = new Set<string>();
  const out: ZdAutomatDailyProposal[] = [];
  for (const p of proposals) {
    const day = warsawKeyFromIso(p.createdAt);
    if (seen.has(day)) continue;
    seen.add(day);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/** Ostatni wynik w jednym zdaniu dla kolumny „Ostatnio”. */
export function zdAutomatLastResultLabel(p: ZdAutomatDailyProposal | undefined, todayKey: string): string {
  if (!p) return "jeszcze brak";
  const day = formatAutomatDay(warsawKeyFromIso(p.createdAt), todayKey);
  switch (p.status) {
    case "pending":
      return p.createAttemptedAt ? `tworzenie ZD niepotwierdzone · ${day}` : `czeka od ${day}`;
    case "accepted":
      return p.dokNr ? `${p.dokNr} · ${day}` : `zatwierdzona · ${day}`;
    case "rejected":
      return `odrzucona · ${day}`;
    case "expired":
      return `wygasła bez decyzji · ${day}`;
    case "deferred":
      return `odłożona (minimum) · ${day}`;
  }
}

/**
 * Gdzie jest zamówienie automatu na drodze „sprawdź → ZD w Subiekcie → mail do dostawcy”.
 * review — czeka na sprawdzenie; unconfirmed — Subiekt nie potwierdził zapisu ZD; send — ZD jest, mail nie poszedł;
 * sent — mail wysłany z OnTime; rejected — odrzucona dziś.
 */
export type ZdAutomatTodayStage = "review" | "unconfirmed" | "send" | "sent" | "rejected";

export type ZdAutomatTodayOrder = {
  supplierId: string;
  supplierName: string;
  proposal: ZdAutomatDailyProposal;
  stage: ZdAutomatTodayStage;
};

const STAGE_RANK: Record<ZdAutomatTodayStage, number> = { unconfirmed: 0, review: 1, send: 2, sent: 3, rejected: 4 };

/** Ile kroków z trzech („Sprawdzenie”, „ZD w Subiekcie”, „Mail”) jest za zamówieniem. */
export function zdAutomatTodayStageStep(stage: ZdAutomatTodayStage): number {
  return stage === "sent" ? 3 : stage === "send" ? 2 : 0;
}

/**
 * Zamówienia automatu na dziś: czekające propozycje (najnowsza dostawcy) oraz te zatwierdzone lub odrzucone dziś.
 * `done` = mail wysłany albo odrzucona — pasek postępu w panelu dziennym. Kolejność: najpierw to, co czeka na Ciebie.
 */
export function zdAutomatTodayOrders(
  suppliers: readonly ZdAutomatDailySupplier[],
  todayKey: string
): { orders: ZdAutomatTodayOrder[]; done: number } {
  const orders: ZdAutomatTodayOrder[] = [];
  for (const s of suppliers) {
    s.proposals.forEach((p, i) => {
      const decidedToday = p.decidedAt != null && warsawKeyFromIso(p.decidedAt) === todayKey;
      const stage: ZdAutomatTodayStage | null =
        p.status === "pending" && i === 0
          ? p.createAttemptedAt
            ? "unconfirmed"
            : "review"
          : p.status === "accepted" && decidedToday
            ? p.mailSentAt
              ? "sent"
              : "send"
            : p.status === "rejected" && decidedToday
              ? "rejected"
              : null;
      if (stage) orders.push({ supplierId: s.id, supplierName: s.name, proposal: p, stage });
    });
  }
  orders.sort((a, b) => STAGE_RANK[a.stage] - STAGE_RANK[b.stage] || a.supplierName.localeCompare(b.supplierName, "pl"));
  return { orders, done: orders.filter((o) => o.stage === "sent" || o.stage === "rejected").length };
}

/** Dopełniacz po „u” / „z”: u 1 dostawcy, u 2 / 5 dostawców. */
const uDostawc = (n: number) => (n === 1 ? "dostawcy" : "dostawców");

export type ZdAutomatDailyStatus = {
  tone: "neutral" | "warning" | "success";
  headline: string;
  detail: string;
  /** Jedna akcja: sprawdzić czekającą propozycję albo naprawić zatrzymany automat (rozwija dostawcę). */
  action: { kind: "review" | "open"; supplierId: string; label: string } | null;
};

/**
 * Zdanie stanu sekcji — najpierw to, co wymaga Ciebie (czeka propozycja, automat stoi, nocny przebieg padł),
 * potem najbliższa propozycja.
 */
export function buildZdAutomatDailyStatus(
  data: ZdAutomatDailyData,
  ctx: { todayKey: string; nowMinutes: number }
): ZdAutomatDailyStatus | null {
  if (!data.suppliers.length) return null;
  const night = zdAutomatNightRunState(data.run, ctx.todayKey, ctx.nowMinutes);
  const nightPassed = zdAutomatNightPassed(night);
  const views = data.suppliers.map((s) => ({ s, v: zdAutomatSupplierView(s, { todayKey: ctx.todayKey, nightPassed }) }));
  const n = data.suppliers.length;
  const upcoming = views
    .filter((x) => x.v.nextKey)
    .sort((a, b) => a.v.nextKey!.localeCompare(b.v.nextKey!) || a.s.name.localeCompare(b.s.name, "pl"));
  const next = upcoming[0];
  const nextText = next
    ? `Następna: ${next.s.name} ${formatAutomatDay(next.v.nextKey!, ctx.todayKey)}${
        daysBetweenKeys(ctx.todayKey, next.v.nextKey!) <= 1 ? ` ${ZD_AUTOMAT_NIGHT_RUN_TIME}` : ""
      }.`
    : "Żadna propozycja nie jest zaplanowana.";
  const nightText =
    night.kind === "done"
      ? `Nocny przebieg dziś ${timeOf(night.at)}${night.failed ? " - z błędem" : night.partial ? " - częściowy" : ""}.`
      : night.kind === "running"
        ? "Nocny przebieg trwa."
        : night.kind === "missing"
          ? `Dziś nie było nocnego przebiegu${night.lastRunDate ? ` (ostatni ${formatAutomatDay(night.lastRunDate, ctx.todayKey)})` : ""} - propozycje nie powstały.`
          : "";

  const pending = views.filter((x) => x.v.pending);
  if (pending.length) {
    const first = pending[0]!;
    const expires = first.v.nextKey ? `, wygaśnie przy następnej (${formatAutomatDay(first.v.nextKey, ctx.todayKey)})` : "";
    if (pending.length === 1 && first.v.pending!.createAttemptedAt) {
      // Timeout Subiekta przy tworzeniu ZD: wynik nieznany — nocny przebieg uzgodni go z dokumentami w Subiekcie.
      return {
        tone: "warning",
        headline: `Tworzenie ZD ${first.s.name} niepotwierdzone`,
        detail: `Subiekt nie potwierdził zapisu - sprawdź w Subiekcie, czy ZD powstało, zanim zamówisz ponownie. Nocny przebieg uzgodni propozycję sam. ${nightText}`.trim(),
        action: { kind: "review", supplierId: first.s.id, label: "Sprawdź propozycję" },
      };
    }
    return {
      tone: "warning",
      headline:
        pending.length === 1
          ? `Propozycja ${first.s.name} czeka na decyzję`
          : `${pending.length} ${polishPluralWord(pending.length, "propozycja czeka", "propozycje czekają", "propozycji czeka")} na decyzję`,
      detail: `${pending.length === 1 ? `Od ${formatAutomatDay(warsawKeyFromIso(first.v.pending!.createdAt), ctx.todayKey)}${expires}.` : pending.map((x) => x.s.name).join(", ") + "."} ${nightText}`.trim(),
      action: { kind: "review", supplierId: first.s.id, label: pending.length === 1 ? "Sprawdź propozycję" : "Sprawdź pierwszą" },
    };
  }
  const stopped = views.filter((x) => x.v.stopReason || x.v.attemptProblem);
  if (stopped.length) {
    const first = stopped[0]!;
    return {
      tone: "warning",
      headline:
        stopped.length === 1
          ? `Automat ${first.s.name} stoi`
          : `Automat stoi u ${stopped.length} z ${n} ${uDostawc(n)}`,
      detail: `${first.s.name}: ${first.v.stopReason ?? first.v.attemptProblem}. ${nextText}`,
      action: { kind: "open", supplierId: first.s.id, label: "Pokaż powód" },
    };
  }
  if (night.kind === "missing" || (night.kind === "done" && night.failed)) {
    return { tone: "warning", headline: "Nocny przebieg automatu nie poszedł", detail: `${nightText} ${nextText}`.trim(), action: null };
  }
  return {
    tone: "neutral",
    headline: next
      ? `Automat ZD u ${n} ${uDostawc(n)}: następna propozycja ${formatAutomatDay(next.v.nextKey!, ctx.todayKey)} (${next.s.name})`
      : `Automat ZD u ${n} ${uDostawc(n)}`,
    detail: [nightText, "Propozycja powstaje w nocnym przebiegu w dzień roboczy, gdy jest co zamówić."].filter(Boolean).join(" "),
    action: null,
  };
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" });
}
