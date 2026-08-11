/**
 * Deterministyczny postęp UI przy „Utwórz ZD” (jedna akcja serwerowa bez streamu).
 * Pasek i checklista idą z czasem — nie stoją na 0% podczas długiego POST Sfery.
 */

/** Limit timeoutu create (zgodnie z SUBIEKT_ORDERS_ZD_CREATE_TIMEOUT_MS). */
export const ZD_CREATE_PROGRESS_TIMEOUT_MS = 180_000;

export const ZD_CREATE_PROGRESS_STEP_COUNT = 4;

/** Soft-warn z preview — dłuższy „parking” na kroku Sfery. */
export const ZD_CREATE_PROGRESS_LARGE_LINES = 200;

export type ZdCreateProgressStepId =
  | "prepare"
  | "sfera"
  | "readback"
  | "snapshot";

export type ZdCreateProgressStepDef = {
  id: ZdCreateProgressStepId;
  title: string;
  activeHint: string;
  doneHint: string;
};

export const ZD_CREATE_PROGRESS_STEPS: readonly ZdCreateProgressStepDef[] = [
  {
    id: "prepare",
    title: "Przygotowanie",
    activeHint: "Waliduję pozycje i kontrahenta w bazie…",
    doneHint: "Payload gotowy",
  },
  {
    id: "sfera",
    title: "Tworzenie w Subiekcie",
    activeHint: "Sfera buduje dokument ZD — to zwykle najdłuższy krok…",
    doneHint: "Dokument utworzony",
  },
  {
    id: "readback",
    title: "Odczyt ZD",
    activeHint: "Pobieram świeży dokument z Subiekta…",
    doneHint: "Dokument odczytany",
  },
  {
    id: "snapshot",
    title: "Historia szacunku",
    activeHint: "Zapisuję historię dla dostawcy i zakresu…",
    doneHint: "Historia zapisana",
  },
] as const;

/**
 * Czas na przejście między krokami checklisty (zanim „parkujemy” na Sferze / końcu).
 * Duże listy → wolniej wchodzimy w kolejne kroki, żeby komunikat Sfery był dłużej widoczny.
 */
export function createZdProgressStepMs(lineCount: number): number {
  const n = Number.isFinite(lineCount) ? Math.max(0, Math.trunc(lineCount)) : 0;
  if (n > ZD_CREATE_PROGRESS_LARGE_LINES) return 14_000;
  if (n > 80) return 9_000;
  return 5_500;
}

/**
 * Indeks aktywnego kroku 0..last na podstawie upływu czasu.
 * Po wejściu w krok „Sfera” zostajemy dłużej (prawdziwy POST).
 */
export function createZdProgressStepFromElapsed(
  elapsedMs: number,
  opts?: { lineCount?: number; forceComplete?: boolean; stepMs?: number }
): number {
  const last = ZD_CREATE_PROGRESS_STEP_COUNT - 1;
  if (opts?.forceComplete) return last;
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const stepMs = opts?.stepMs ?? createZdProgressStepMs(opts?.lineCount ?? 0);

  // Kroki: 0 prepare → 1 sfera (park dłużej) → dopiero potem readback/snapshot.
  // Świadomie zostajemy na Sferze — postęp jest szacunkowy, nie synchronizowany z POST.
  const raw = Math.floor(safeElapsed / stepMs);
  if (raw <= 0) return 0;
  if (raw <= 3) return 1; // prepare szybko, potem długo „Tworzenie w Subiekcie”
  if (raw === 4) return 2;
  return last;
}

/**
 * Pasek 0–100. Nigdy nie stoi w miejscu: asymptota do ~94% aż do forceComplete.
 * Dzięki temu przy długim POST użytkownik widzi ruch, nie „zacięcie”.
 */
export function createZdProgressPercent(
  elapsedMs: number,
  opts?: {
    forceComplete?: boolean;
    timeoutMs?: number;
  }
): number {
  if (opts?.forceComplete) return 100;
  const timeout = opts?.timeoutMs ?? ZD_CREATE_PROGRESS_TIMEOUT_MS;
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const t = Math.min(1, safeElapsed / Math.max(1, timeout));
  // ease-out: szybki start, potem wolne dociąganie — zawsze > poprzedniego przy stałym ticku
  const eased = 1 - Math.pow(1 - t, 1.25);
  return Math.min(94, Math.round(6 + eased * 88));
}

export function createZdProgressDurationHint(lineCount: number): string {
  const n = Number.isFinite(lineCount) ? Math.max(0, Math.trunc(lineCount)) : 0;
  if (n > ZD_CREATE_PROGRESS_LARGE_LINES) {
    return "Duża lista pozycji — zwykle 1–3 minuty (limit ok. 3 min).";
  }
  if (n > 80) {
    return "Średnia lista — zwykle poniżej 2 minut (limit ok. 3 min).";
  }
  return "Zwykle poniżej minuty; maksymalnie ok. 3 minuty.";
}

export function formatZdCreateElapsedLabel(elapsedMs: number): string {
  const sec = Math.floor(Math.max(0, elapsedMs) / 1000);
  if (sec < 60) return `Minęło ${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `Minęło ${m}:${String(s).padStart(2, "0")}`;
}
