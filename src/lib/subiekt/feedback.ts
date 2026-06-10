import {
  SubiektNetworkError,
  SubiektNotConfiguredError,
  SubiektRequestError,
  SubiektTimeoutError,
} from "@/lib/subiekt/errors";
import { PROCUREMENT_TEAM_LABEL } from "@/lib/orders/procurement-copy";

/** Kody sytuacji — używaj w logice i testach. */
export type SubiektErrorCode =
  | "not_configured"
  | "short_query"
  | "empty_query"
  | "not_found_product"
  | "not_found_supplier"
  | "catalog_supplier_unmapped"
  | "not_found_app_supplier"
  | "timeout"
  | "network"
  | "unreachable"
  | "unauthorized"
  | "http_error"
  | "server_error"
  | "invalid_response"
  | "health_degraded"
  | "sql_not_configured"
  | "subiekt_unavailable"
  | "unknown";

export type SubiektFeedbackTone = "info" | "warning" | "error";

export type SubiektFeedback = {
  code: SubiektErrorCode;
  title: string;
  message: string;
  hint?: string;
  tone: SubiektFeedbackTone;
};

type FeedbackTemplate = Omit<SubiektFeedback, "code">;

const TEMPLATES: Record<SubiektErrorCode, FeedbackTemplate> = {
  not_configured: {
    title: "Brak podpowiedzi Subiekt",
    message: "Integracja nie jest skonfigurowana lub jest poza siecią firmową.",
    hint: "Wyszukiwanie w kartotece nie działa — pola wypełniasz ręcznie.",
    tone: "info",
  },
  short_query: {
    title: "Za krótkie wyszukiwanie",
    message: "Wpisz co najmniej 2 znaki, aby wyszukać w Subiekcie.",
    tone: "info",
  },
  empty_query: {
    title: "Brak frazy",
    message: "Wpisz symbol, nazwę lub NIP, aby wyszukać.",
    tone: "info",
  },
  not_found_product: {
    title: "Nie znaleziono towaru",
    message: "Brak pozycji w kartotece Subiekta dla podanej frazy.",
    hint: "Sprawdź symbol lub wpisz opis produktu ręcznie — prośbę można wysłać bez podpowiedzi.",
    tone: "info",
  },
  not_found_supplier: {
    title: "Nie znaleziono w Subiekcie",
    message: "Brak kontrahenta (dostawcy) pasującego do wyszukiwania.",
    hint: `Wybierz dostawcę z listy w systemie lub zostaw pole puste do uzupełnienia przez ${PROCUREMENT_TEAM_LABEL}.`,
    tone: "info",
  },
  catalog_supplier_unmapped: {
    title: "Brak przypisanego dostawcy",
    message:
      "Towar jest w Subiekcie, ale nie mamy jeszcze powiązania z dostawcą w naszej bazie.",
    hint: "Wybierz dostawcę ręcznie — po zapisie powstanie powiązanie.",
    tone: "info",
  },
  not_found_app_supplier: {
    title: "Brak wyników",
    message: "Żaden dostawca w systemie nie pasuje do wpisanej frazy.",
    hint: "Spróbuj innej nazwy lub skorzystaj z wyszukiwania w Subiekcie (w sieci firmowej).",
    tone: "info",
  },
  timeout: {
    title: "Przekroczono czas oczekiwania",
    message: "Serwer Subiekta nie odpowiedział na czas.",
    hint: "Sprawdź, czy host API działa i czy jesteś w sieci firmowej (LAN). Możesz wpisać dane ręcznie.",
    tone: "warning",
  },
  network: {
    title: "Brak połączenia z Subiektem",
    message: "Nie udało się połączyć z API Subiekta.",
    hint: "Upewnij się, że komputer z aplikacją jest w tej samej sieci co serwer (np. 192.168.0.140) i że usługa nasłuchuje.",
    tone: "warning",
  },
  unreachable: {
    title: "Serwer Subiekta niedostępny",
    message: "Host API nie odpowiada — połączenie zostało odrzucone lub przerwane.",
    hint: "Na stanowisku pracy: ping do adresu z .env.local, potem curl /api/v1/health. Z domu API zwykle nie działa.",
    tone: "warning",
  },
  unauthorized: {
    title: "Odmowa dostępu do API",
    message: "Subiekt odrzucił żądanie (błąd uwierzytelniania).",
    hint: "Sprawdź SUBIEKT_API_KEY i SUBIEKT_API_AUTH_MODE w .env.local lub wyłącz klucz na serwerze (authMode: none).",
    tone: "error",
  },
  http_error: {
    title: "Błąd API Subiekta",
    message: "Serwer zwrócił nieoczekiwaną odpowiedź.",
    hint: "Administrator może sprawdzić logi usługi REST i ponowić test w Administracja → Integracja Subiekt.",
    tone: "error",
  },
  server_error: {
    title: "Błąd serwera Subiekta",
    message: "Wewnętrzny błąd usługi REST (SQL lub aplikacja pośrednia).",
    hint: "Spróbuj za chwilę. Jeśli problem się powtarza — zgłoś do IT / administratora Subiekta.",
    tone: "error",
  },
  invalid_response: {
    title: "Nieprawidłowa odpowiedź",
    message: "API Subiekta zwróciło dane w nieoczekiwanym formacie.",
    hint: "Sprawdź wersję API (/api/v1) i dokumentację. Tymczasowo wpisz pola ręcznie.",
    tone: "warning",
  },
  health_degraded: {
    title: "Subiekt w stanie obniżonym",
    message: "Usługa działa, ale zgłasza status „degraded”.",
    hint: "Odczyt z bazy może być niestabilny — podpowiedzi mogą być niepełne.",
    tone: "warning",
  },
  sql_not_configured: {
    title: "Brak połączenia SQL",
    message: "API Subiekta nie ma skonfiguowanego połączenia z bazą danych.",
    hint: "Skonfiguruj MSSQL po stronie usługi REST — bez SQL podpowiedzi nie zadziałają.",
    tone: "error",
  },
  subiekt_unavailable: {
    title: "Subiekt chwilowo niedostępny",
    message: "API Subiekta nie odpowiada — np. poza LAN lub serwis wyłączony.",
    hint: "Spróbuj w sieci firmowej później. Teraz wpisz symbol i opis ręcznie.",
    tone: "info",
  },
  unknown: {
    title: "Nieznany błąd",
    message: "Wystąpił nieoczekiwany problem podczas komunikacji z Subiektem.",
    hint: "Uzupełnij formularz ręcznie. Szczegóły w panelu administracyjnym (test połączenia).",
    tone: "error",
  },
};

export function getSubiektFeedback(
  code: SubiektErrorCode,
  overrides?: Partial<Pick<SubiektFeedback, "message" | "hint" | "title">>
): SubiektFeedback {
  const base = TEMPLATES[code];
  return {
    code,
    title: overrides?.title ?? base.title,
    message: overrides?.message ?? base.message,
    hint: overrides?.hint ?? base.hint,
    tone: base.tone,
  };
}

function isAbortError(e: unknown): boolean {
  return e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"));
}

function isFetchNetworkMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("fetch failed") ||
    m.includes("econnrefused") ||
    m.includes("enotfound") ||
    m.includes("network") ||
    m.includes("socket") ||
    m.includes("connect")
  );
}

/** Mapuje wyjątek HTTP / sieć → kod komunikatu. */
export function classifySubiektException(e: unknown): SubiektErrorCode {
  if (e instanceof SubiektNotConfiguredError) return "not_configured";
  if (e instanceof SubiektTimeoutError) return "timeout";
  if (e instanceof SubiektNetworkError) {
    const msg = e.message.toLowerCase();
    if (isFetchNetworkMessage(msg) || msg.includes("refused")) return "unreachable";
    return "network";
  }
  if (e instanceof SubiektRequestError) {
    if (e.status === 401 || e.status === 403) return "unauthorized";
    if (e.status >= 500) return "server_error";
    if (e.status === 404) return "http_error";
    if (e.bodySnippet.includes("JSON") || e.bodySnippet.includes("json")) {
      return "invalid_response";
    }
    return "http_error";
  }
  if (isAbortError(e)) return "timeout";
  if (e instanceof Error) {
    if (isFetchNetworkMessage(e.message)) return "unreachable";
    if (e.message.includes("JSON")) return "invalid_response";
  }
  return "unknown";
}

export function feedbackFromException(
  e: unknown,
  detail?: string
): SubiektFeedback {
  const code = classifySubiektException(e);
  const feedback = getSubiektFeedback(code);
  if (!detail) return feedback;
  if (code === "http_error" || code === "server_error" || code === "unknown") {
    return {
      ...feedback,
      message: `${feedback.message} (${detail})`,
    };
  }
  return feedback;
}

export function notFoundProductFeedback(query: string): SubiektFeedback {
  return getSubiektFeedback("not_found_product", {
    message: `Brak towaru w Subiekcie dla „${query}”.`,
  });
}

export function notFoundSupplierFeedback(query: string): SubiektFeedback {
  return getSubiektFeedback("not_found_supplier", {
    message: `Brak dostawcy w Subiekcie dla „${query}”.`,
  });
}

export function catalogSupplierUnmappedFeedback(
  overrides?: Partial<Pick<SubiektFeedback, "message" | "hint" | "title">>
): SubiektFeedback {
  return getSubiektFeedback("catalog_supplier_unmapped", overrides);
}

export function notFoundClientFeedback(query: string): SubiektFeedback {
  return getSubiektFeedback("not_found_supplier", {
    title: "Nie znaleziono klienta",
    message: `Brak odbiorcy w Subiekcie dla „${query}”.`,
    hint: "Możesz wpisać dowolną nazwę ręcznie — pole jest opcjonalne.",
  });
}

