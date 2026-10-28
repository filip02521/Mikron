import type { Instrumentation } from "next";

/** Nieobsłużone błędy serwera (strony, trasy API, server actions) → PostHog error tracking. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureServerException } = await import("@/lib/posthog/server");
  const { stripQuery } = await import("@/lib/posthog/config");
  const header = (name: string) => {
    const v = request.headers[name];
    return Array.isArray(v) ? v[0] : v;
  };
  // Nagłówki dodaje posthog-js (__add_tracing_headers): błąd trafia do osoby i nagrania.
  const distinctId = header("x-posthog-distinct-id");
  const sessionId = header("x-posthog-session-id");
  // digest = ten sam kod, który widzi ekran błędu w przeglądarce — łączy oba zgłoszenia.
  const digest =
    typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  captureServerException(
    err,
    {
      path: stripQuery(request.path),
      method: request.method,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      digest,
      ...(sessionId ? { $session_id: sessionId } : {}),
    },
    distinctId
  );
};
