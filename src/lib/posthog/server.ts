import { PostHog } from "posthog-node";
import { POSTHOG_HOST, POSTHOG_KEY } from "@/lib/posthog/config";

/** Zdarzenia serwera (crony, błędy bez sesji) nie tworzą osoby w PostHog. */
export const SERVER_DISTINCT_ID = "ontime-server";

let client: PostHog | null | undefined;

function getClient(): PostHog | null {
  if (client !== undefined) return client;
  const enabled =
    process.env.NODE_ENV === "production" &&
    process.env.E2E_LAB !== "1" &&
    process.env.POSTHOG_DISABLED !== "1";
  // Wysyłka w tle od razu (flushAt 1): OnTime to stale działająca usługa, a cron nie czeka na PostHog.
  client = enabled ? new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST, flushAt: 1 }) : null;
  return client;
}

export function captureServerException(
  error: unknown,
  properties: Record<string, unknown>,
  distinctId?: string
): void {
  getClient()?.captureException(error, distinctId ?? SERVER_DISTINCT_ID, {
    ...properties,
    ...(distinctId ? {} : { $process_person_profile: false }),
  });
}

export function captureServerEvent(event: string, properties: Record<string, unknown>): void {
  getClient()?.capture({
    distinctId: SERVER_DISTINCT_ID,
    event,
    properties: { ...properties, $process_person_profile: false },
  });
}
