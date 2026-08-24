import { getCronSecret } from "@/lib/env/app-config";

export type RaportyRunnerStatus = {
  ok: true;
  sendEnabled: boolean;
  overrideTo: string | null;
  productionSent: boolean;
  periodKey: string | null;
  periodLabel: string | null;
  runnerUrl: string;
};

export type RaportyRunnerStatusResult =
  | RaportyRunnerStatus
  | {
      ok: false;
      reason:
        | "missing_url"
        | "missing_secret"
        | "unauthorized"
        | "unreachable"
        | "invalid_response";
      runnerUrl: string | null;
      detail?: string;
    };

function resolveRaportyRunnerUrl(): string | null {
  // Tylko server-side — bez NEXT_PUBLIC_*, żeby URL runnera nie wyciekł do bundla klienta.
  const raw = process.env.RAPORTY_RUNNER_URL?.trim() || "";
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

function resolveRaportyAuthSecret(): string | undefined {
  const dedicated = process.env.RAPORTY_CRON_SECRET?.trim();
  if (dedicated) return dedicated;
  return getCronSecret();
}

/**
 * Live status from OnTime Raporty `GET /api/ivoclar/status`
 * (Bearer = RAPORTY_CRON_SECRET or shared CRON_SECRET).
 */
export async function fetchRaportyRunnerStatus(
  options?: { timeoutMs?: number; fetchImpl?: typeof fetch }
): Promise<RaportyRunnerStatusResult> {
  const runnerUrl = resolveRaportyRunnerUrl();
  if (!runnerUrl) {
    return { ok: false, reason: "missing_url", runnerUrl: null };
  }

  const secret = resolveRaportyAuthSecret();
  if (!secret) {
    return { ok: false, reason: "missing_secret", runnerUrl };
  }

  const timeoutMs = options?.timeoutMs ?? 4_000;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(`${runnerUrl}/api/ivoclar/status`, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "unauthorized", runnerUrl };
    }
    if (!res.ok) {
      return {
        ok: false,
        reason: "unreachable",
        runnerUrl,
        detail: `HTTP ${res.status}`,
      };
    }

    const body = (await res.json()) as {
      ok?: boolean;
      sendEnabled?: unknown;
      overrideTo?: unknown;
      productionSent?: unknown;
      period?: { periodKey?: unknown; periodLabel?: unknown };
      defaultPeriod?: { periodKey?: unknown; periodLabel?: unknown };
    };

    if (body.ok !== true || typeof body.sendEnabled !== "boolean") {
      return { ok: false, reason: "invalid_response", runnerUrl };
    }

    const period = body.period ?? body.defaultPeriod;
    return {
      ok: true,
      sendEnabled: body.sendEnabled,
      overrideTo: typeof body.overrideTo === "string" ? body.overrideTo : null,
      productionSent: body.productionSent === true,
      periodKey: typeof period?.periodKey === "string" ? period.periodKey : null,
      periodLabel:
        typeof period?.periodLabel === "string" ? period.periodLabel : null,
      runnerUrl,
    };
  } catch (e) {
    return {
      ok: false,
      reason: "unreachable",
      runnerUrl,
      detail: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function raportyRunnerStatusLabel(
  status: RaportyRunnerStatusResult
): string {
  if (!status.ok) {
    switch (status.reason) {
      case "missing_url":
        return "Brak RAPORTY_RUNNER_URL — nie da się odczytać SEND z runnera";
      case "missing_secret":
        return "Brak CRON_SECRET / RAPORTY_CRON_SECRET do odczytu statusu runnera";
      case "unauthorized":
        return "Runner odrzucił auth (sprawdź CRON_SECRET vs RAPORTY_CRON_SECRET)";
      case "invalid_response":
        return "Runner zwrócił nieoczekiwaną odpowiedź statusu";
      case "unreachable":
        return status.detail
          ? `Runner niedostępny (${status.detail})`
          : "Runner niedostępny";
    }
  }
  if (status.sendEnabled) {
    return status.overrideTo
      ? `Wysyłka włączona (override → ${status.overrideTo})`
      : "Wysyłka produkcyjna włączona (IVOCLAR_SEND_ENABLED=1)";
  }
  return "Wysyłka wyłączona na runnerze (IVOCLAR_SEND_ENABLED≠1)";
}
