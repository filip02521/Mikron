/**
 * Zamiana surowych wyjątków / stacków na krótkie komunikaty UI.
 * Używane przez toastFromError i miejsca catch w client components.
 */

import { MICROCOPY } from "@/lib/ui/microcopy";

export type UserFacingErrorKind =
  | "unauthorized"
  | "session"
  | "network"
  | "generic";

export type UserFacingErrorCopy = {
  kind: UserFacingErrorKind;
  title: string;
  description: string;
};

const UNAUTHORIZED_PATTERNS = [
  /brak uprawnie[nń]/i,
  /nie masz uprawnie[nń]/i,
  /unauthorized/i,
  /forbidden/i,
  /access denied/i,
  /permission denied/i,
];

const SESSION_PATTERNS = [
  /brak sesji/i,
  /sesja wygas/i,
  /session expired/i,
  /zaloguj się ponownie/i,
  /not authenticated/i,
  /wymagane logowanie/i,
  /brak aktywnej sesji/i,
];

const NETWORK_PATTERNS = [
  /failed to fetch/i,
  /network error/i,
  /load failed/i,
  /econnreset/i,
  /etimedout/i,
  /aborted/i,
  /unexpected response was received from the server/i,
];

/** Znane komunikaty auth → krótki, ludzki opis. */
const KNOWN_AUTH_MESSAGES: Array<{ match: RegExp; description: string }> = [
  {
    match: /numer[oó]w kurier/i,
    description:
      "To konto nie może przeglądać numerów telefonów kurierów. Zaloguj się na konto magazynu lub zakupów.",
  },
  {
    match: /operacji zakupowych/i,
    description:
      "To konto nie ma dostępu do funkcji zakupów. Użyj konta z uprawnieniami zakupów albo magazynu.",
  },
  {
    match: /uprawnie[nń].*magazynu|magazynu.*uprawnie[nń]|brak uprawnie[nń] magazynu/i,
    description:
      "To konto nie ma dostępu do funkcji magazynu. Poproś administratora o odpowiednie uprawnienia.",
  },
  {
    match: /panelu z[eę]b/i,
    description: "To konto nie ma dostępu do panelu zębów.",
  },
  {
    match: /administratora/i,
    description: "Ta operacja wymaga konta administratora.",
  },
  {
    match: /prośby tego handlowca|składania prośby dla tego handlowca/i,
    description:
      "Nie możesz otworzyć ZK ani złożyć prośby w imieniu tej osoby. Użyj własnego konta albo konta kierownika z dostępem do jej grupy.",
  },
  {
    match: /powiązane z kartą handlowca/i,
    description:
      "To konto nie jest powiązane z kartą handlowca. Poproś administratora o przypisanie.",
  },
  {
    match: /brak uprawnie[nń] handlowca\b/i,
    description: "Ta operacja wymaga konta handlowca.",
  },
];

const MAX_DETAIL_LEN = 160;

/**
 * Wyciąga treść z Error / string / obiektu Next (digest).
 * Bez stacka — tylko pierwsza sensowna linia.
 */
export function extractRawErrorMessage(error: unknown): string {
  if (error == null) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || error.name || "";
  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message.trim()) return obj.message;
    if (typeof obj.error === "string" && obj.error.trim()) return obj.error;
  }
  return String(error);
}

/**
 * Usuwa stack, prefiksy Error:, digest Next.js i śmieci techniczne.
 */
export function sanitizeUserFacingErrorMessage(
  raw: string | null | undefined
): string {
  if (!raw) return "";
  let text = String(raw).replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  // Next / React: "Error: foo\n    at ..."
  text = text.replace(/^(?:Error|TypeError|ReferenceError):\s*/i, "");

  // Odetnij stack od pierwszej linii "at " / "    at "
  const stackIdx = text.search(/\n\s+at\s+/);
  if (stackIdx >= 0) text = text.slice(0, stackIdx);

  // Digest / boundary
  text = text
    .replace(/\s*\[digest:[^\]]*\]/gi, "")
    .replace(/\s*Digest:\s*\S+/gi, "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Prefiks "Error: " mógł zostać po stacku
  text = text.replace(/^(?:Error|TypeError|ReferenceError):\s*/i, "");

  if (text.length > MAX_DETAIL_LEN) {
    const cut = text.slice(0, MAX_DETAIL_LEN);
    const lastSpace = cut.lastIndexOf(" ");
    text = `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
  }

  return text;
}

/** Surowy dump / errno / stack — nie pokazuj użytkownikowi. */
export function looksLikeTechnicalErrorDump(cleaned: string): boolean {
  if (!cleaned) return true;
  if (/\bat\s+\w+/i.test(cleaned)) return true;
  if (
    /^(?:TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError)\b/i.test(
      cleaned
    )
  ) {
    return true;
  }
  if (
    /\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ENOENT|EPIPE|EACCES)\b/i.test(
      cleaned
    )
  ) {
    return true;
  }
  if (
    /cannot read propert|is not a function|unexpected token|internal server error|fetch failed|network request failed|null is not an object|undefined is not/i.test(
      cleaned
    )
  ) {
    return true;
  }
  // Minifikowany / hex dump
  if (/^[a-f0-9]{16,}$/i.test(cleaned)) return true;
  return false;
}

function matchKnownAuthDescription(message: string): string | null {
  for (const entry of KNOWN_AUTH_MESSAGES) {
    if (entry.match.test(message)) return entry.description;
  }
  return null;
}

/**
 * Klasyfikuje komunikat i zwraca gotowy nagłówek + treść pod toast / Alert.
 */
export function classifyUserFacingError(
  raw: string | null | undefined
): UserFacingErrorCopy {
  const cleaned = sanitizeUserFacingErrorMessage(raw);

  if (SESSION_PATTERNS.some((p) => p.test(cleaned))) {
    return {
      kind: "session",
      title: "Sesja wygasła",
      description: MICROCOPY.errors.sessionExpired,
    };
  }

  if (UNAUTHORIZED_PATTERNS.some((p) => p.test(cleaned))) {
    const known = matchKnownAuthDescription(cleaned);
    if (known) {
      return {
        kind: "unauthorized",
        title: "Brak uprawnień",
        description: known,
      };
    }
    // „Unauthorized” / „Forbidden” → ogólny PL; konkretny PL auth zachowaj.
    const isGenericEnglishAuth =
      /^(unauthorized|forbidden|access denied|permission denied)\.?$/i.test(
        cleaned
      );
    return {
      kind: "unauthorized",
      title: "Brak uprawnień",
      description:
        isGenericEnglishAuth || !cleaned
          ? MICROCOPY.errors.unauthorized
          : cleaned,
    };
  }

  if (NETWORK_PATTERNS.some((p) => p.test(cleaned))) {
    return {
      kind: "network",
      title: "Problem z połączeniem",
      description:
        "Nie udało się połączyć z serwerem. Sprawdź sieć i spróbuj ponownie.",
    };
  }

  if (!cleaned || looksLikeTechnicalErrorDump(cleaned)) {
    return {
      kind: "generic",
      title: "Operacja nie powiodła się",
      description: MICROCOPY.errors.generic,
    };
  }

  // Krótki, czytelny komunikat (PL lub konkretny opis biznesowy) — zachowaj.
  return {
    kind: "generic",
    title: "Operacja nie powiodła się",
    description: cleaned,
  };
}

/** Z dowolnego throw / message → copy UI. */
export function userFacingErrorFromUnknown(
  error: unknown,
  fallbackDescription?: string
): UserFacingErrorCopy {
  const raw = extractRawErrorMessage(error);
  const classified = classifyUserFacingError(raw);
  const fallback = fallbackDescription?.trim();

  // Techniczny dump / pustka → kontekst z callera zamiast ogólnego „coś poszło nie tak”.
  if (
    fallback &&
    classified.kind === "generic" &&
    classified.description === MICROCOPY.errors.generic
  ) {
    return {
      kind: "generic",
      title: "Operacja nie powiodła się",
      description: fallback,
    };
  }

  return classified;
}

/**
 * Jedna linia pod Alert / setError / onError(string).
 * Uprawnienia i sesja: „Tytuł — opis”; reszta: sam opis.
 */
export function userFacingErrorText(
  error: unknown,
  fallbackDescription?: string
): string {
  const copy = userFacingErrorFromUnknown(error, fallbackDescription);
  if (copy.kind === "session") {
    // Client-only: natychmiast na login (bez „martwego” UI).
    void import("@/lib/auth/session-login-redirect").then((m) => {
      m.redirectToLoginForLostSession();
    });
  }
  if (copy.kind === "unauthorized" || copy.kind === "session") {
    return `${copy.title} — ${copy.description}`;
  }
  return copy.description;
}

/**
 * Gdy action zwraca `{ error: string }` — zhumanizuj string (stack / uprawnienia).
 */
export function userFacingErrorTextFromMessage(
  message: string | null | undefined,
  fallbackDescription?: string
): string {
  return userFacingErrorText(message ?? null, fallbackDescription);
}
