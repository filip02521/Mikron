import type { ZdEstimateRunJobState } from "@/lib/orders/zd-estimate-run-jobs";

/** Przeglądarka: start liczenia w tle + odbiór wyniku krótkimi zapytaniami (bez jednego długiego żądania). */

export type ZdEstimateRunAwaitFailure = {
  code: "timeout" | "network" | "unknown";
  title: string;
  message: string;
  hint: string;
};

export type ZdEstimateRunAwaitOutcome<T> =
  | { ok: true; result: T }
  | { ok: false; failure: ZdEstimateRunAwaitFailure }
  /** Czekający zniknął (wyjście z Kreatora) — liczenie trwa dalej na serwerze, wynik odbierze ktoś inny. */
  | { ok: false; failure: null };

const POLL_INTERVAL_MS = 1_000;
/** Zgodne z czasem życia zadania na serwerze (`ZD_ESTIMATE_RUN_JOB_RUNNING_TTL_MS`). */
const MAX_WAIT_MS = 20 * 60_000;
/** Kolejne nieudane odbiory (zerwana sieć, restart usługi), zanim uznamy, że połączenia nie ma. */
const MAX_COLLECT_ERRORS_IN_ROW = 10;

const RETRY_HINT = "Policz listę ponownie.";

export async function awaitZdEstimateRunJob<T>(opts: {
  start: () => Promise<{ ok: true; runId: string; ownerUserId: string } | { ok: false; message: string }>;
  collect: (runId: string) => Promise<ZdEstimateRunJobState<T>>;
  /** Serwer przyjął liczenie. */
  onStarted?: (started: { runId: string; ownerUserId: string }) => void;
  /** true = przestań czekać (bez błędu). */
  isAbandoned?: () => boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<ZdEstimateRunAwaitOutcome<T>> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  const connectionLost: ZdEstimateRunAwaitFailure = {
    code: "network",
    title: "Brak połączenia z OnTime",
    message: "Nie udało się połączyć z serwerem OnTime podczas liczenia listy.",
    hint: `Sprawdź sieć. ${RETRY_HINT}`,
  };

  let started: Awaited<ReturnType<typeof opts.start>>;
  try {
    started = await opts.start();
  } catch {
    return { ok: false, failure: connectionLost };
  }
  if (!started.ok) {
    return {
      ok: false,
      failure: { code: "unknown", title: "Nie udało się zacząć liczenia", message: started.message, hint: RETRY_HINT },
    };
  }

  opts.onStarted?.({ runId: started.runId, ownerUserId: started.ownerUserId });

  const deadline = now() + MAX_WAIT_MS;
  let errorsInRow = 0;
  while (now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    if (opts.isAbandoned?.()) return { ok: false, failure: null };
    let job: ZdEstimateRunJobState<T>;
    try {
      job = await opts.collect(started.runId);
    } catch {
      errorsInRow += 1;
      if (errorsInRow >= MAX_COLLECT_ERRORS_IN_ROW) return { ok: false, failure: connectionLost };
      continue;
    }
    errorsInRow = 0;
    if (job.state === "done") return { ok: true, result: job.result };
    if (job.state === "missing") {
      return {
        ok: false,
        failure: {
          code: "unknown",
          title: "Liczenie zostało przerwane",
          message: "Serwer OnTime przerwał liczenie listy (np. restart usługi), zanim oddał wynik.",
          hint: RETRY_HINT,
        },
      };
    }
  }
  return {
    ok: false,
    failure: {
      code: "timeout",
      title: "Liczenie listy trwało zbyt długo",
      message: "Serwer nie oddał listy do zamówienia w ciągu 20 minut.",
      hint: `${RETRY_HINT} Jeśli się powtarza, zawęź zakres.`,
    },
  };
}
