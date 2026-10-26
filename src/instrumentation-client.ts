import posthog from "posthog-js";
import { POSTHOG_HOST, POSTHOG_KEY, stripQuery } from "@/lib/posthog/config";
import { scrubCapture } from "@/lib/posthog/scrub";

const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

// Tylko produkcja (bez lokalnego next start i e2e na 127.0.0.1).
if (
  process.env.NODE_ENV === "production" &&
  !loopback &&
  process.env.NEXT_PUBLIC_POSTHOG_DISABLED !== "1"
) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    ui_host: "https://eu.posthog.com",
    defaults: "2026-08-30",
    person_profiles: "identified_only",
    capture_exceptions: true,
    // Na ekranach są klienci i dostawcy: autocapture bez tekstu, nagrania z zamaskowanym tekstem,
    // bez treści zapytań, konsoli i query w adresach (RODO).
    mask_all_text: true,
    mask_all_element_attributes: true,
    enable_recording_console_log: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "*",
      recordBody: false,
      recordHeaders: false,
      maskCapturedNetworkRequestFn: (request) => ({ ...request, name: String(stripQuery(request.name)) }),
    },
    disable_surveys: true,
    // Nagłówki sesji przy żądaniach do aplikacji — błąd serwera łączy się z nagraniem.
    __add_tracing_headers: [window.location.hostname],
    before_send: scrubCapture,
  });
}
