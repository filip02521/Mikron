/**
 * Mapuje surowe błędy Sfery / InsERT COM (create ZD) na komunikaty dla użytkownika.
 * API ORDERS często dokleja mylącą wskazówkę o loginie SQL przy nieznanych HRESULT.
 */

export type SferaCreateErrorKind =
  | "license_limit"
  | "sfera_host_limit"
  | "sfera_busy"
  | "sfera_not_configured"
  | "unknown";

export type HumanizedSferaCreateError = {
  kind: SferaCreateErrorKind;
  title: string;
  /** Pełny tekst do Alert — bez surowego HRESULT i bez mylącej wskazówki SQL. */
  message: string;
};

const LICENSE_LIMIT_HEX = "800413d5";
const SFERA_HOST_LIMIT_HEX = "800412be";
/** 0x800413D5 jako signed int32 */
const LICENSE_LIMIT_DEC = "-2147216427";
/** 0x800412BE jako signed int32 */
const SFERA_HOST_LIMIT_DEC = "-2147216706";

function normalizeErrorBlob(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function extractHresults(raw: string): string[] {
  const found = new Set<string>();
  const hex = raw.matchAll(/0x([0-9a-fA-F]{8})\b/g);
  for (const m of hex) {
    found.add(m[1]!.toLowerCase());
  }
  const bare = raw.matchAll(/\b([89][0-9a-fA-F]{7})\b/g);
  for (const m of bare) {
    found.add(m[1]!.toLowerCase());
  }
  return [...found];
}

function mentionsLicenseOverflow(raw: string): boolean {
  const m = raw.toLowerCase();
  return (
    m.includes("przekroczony limit") ||
    m.includes("przekroczono limit") ||
    m.includes("limit wykupionych licenc") ||
    m.includes("ins_e_przekroczony_limit_licencji") ||
    m.includes("zajęta licencja") ||
    m.includes("zajeta licencja")
  );
}

function mentionsSferaHostLimit(raw: string): boolean {
  const m = raw.toLowerCase();
  return (
    m.includes("license_host_limit") ||
    m.includes("ograniczenie licencji sfery") ||
    m.includes("licencji sfery na liczbę stanowisk") ||
    m.includes("licencji sfery na liczbe stanowisk")
  );
}

/**
 * Zwraca przyjazny komunikat albo `null`, gdy nie rozpoznano typowego błędu Sfery
 * (wtedy caller może zostawić skrócony / surowy tekst).
 */
export function humanizeSferaCreateError(
  rawMessage: string
): HumanizedSferaCreateError | null {
  const raw = normalizeErrorBlob(rawMessage);
  if (!raw) return null;

  const lower = raw.toLowerCase();
  const hresults = extractHresults(raw);
  const hasLicenseHresult =
    hresults.includes(LICENSE_LIMIT_HEX) || raw.includes(LICENSE_LIMIT_DEC);
  const hasHostLimitHresult =
    hresults.includes(SFERA_HOST_LIMIT_HEX) ||
    raw.includes(SFERA_HOST_LIMIT_DEC);

  if (hasLicenseHresult || mentionsLicenseOverflow(raw)) {
    return {
      kind: "license_limit",
      title: "Zajęta licencja Subiekta",
      message:
        "Nie udało się utworzyć ZD — wszystkie stanowiska z licencją Sfery są zajęte. " +
        "Zamknij zbędne okna Subiekta i inne programy korzystające ze Sfery, poczekaj chwilę i spróbuj ponownie. " +
        "Jeśli problem wraca, IT: Program Serwisowy → zajęte stanowiska Sfery (identyfikator 31).",
    };
  }

  if (hasHostLimitHresult || mentionsSferaHostLimit(raw)) {
    return {
      kind: "sfera_host_limit",
      title: "Brak wolnego stanowiska Sfery",
      message:
        "Osiągnięto limit licencji Sfery na liczbę stanowisk. " +
        "Zwolnij Sferę na innym komputerze albo skontaktuj się z IT w sprawie rozszerzenia licencji.",
    };
  }

  if (
    lower.includes("sfera_not_configured") ||
    lower.includes("sfera nie jest skonfigurowana") ||
    lower.includes("sfera not configured")
  ) {
    return {
      kind: "sfera_not_configured",
      title: "Sfera nie skonfigurowana",
      message:
        "Sfera Subiekta nie jest skonfigurowana na serwerze ORDERS. " +
        "Zgłoś do IT — bez Sfery kreator nie może utworzyć ZD w Subiekcie.",
    };
  }

  if (
    lower.includes("sfera") &&
    (lower.includes("zajęta") ||
      lower.includes("zajeta") ||
      lower.includes("busy") ||
      lower.includes("niedostępna") ||
      lower.includes("niedostepna"))
  ) {
    return {
      kind: "sfera_busy",
      title: "Sfera zajęta",
      message:
        "Sfera Subiekta jest chwilowo zajęta lub niedostępna. Spróbuj ponownie za chwilę. " +
        "Nie twórz tego samego ZD drugi raz „w ciemno” — najpierw sprawdź w Subiekcie, czy dokument już powstał.",
    };
  }

  return null;
}

export type FormattedZdCreateSferaMessage = {
  title: string;
  message: string;
};

/**
 * Tekst do UI: rozpoznany komunikat albo surowy bez mylącej „Wskazówka: login/hasło SQL…”,
 * gdy widać HRESULT (API nie znało kodu InsERT).
 */
export function formatZdCreateSferaUserMessage(
  rawMessage: string
): FormattedZdCreateSferaMessage {
  const humanized = humanizeSferaCreateError(rawMessage);
  if (humanized) {
    return { title: humanized.title, message: humanized.message };
  }

  const raw = normalizeErrorBlob(rawMessage);
  if (!raw) {
    return {
      title: "Błąd Sfery",
      message: "Sfera Subiekta niedostępna lub zajęta. Spróbuj za chwilę.",
    };
  }

  // Obetnij generyczną wskazówkę API ORDERS — myli przy błędach COM/licencji.
  const withoutMisleadingHint = raw
    .replace(/\s*\|\s*Wskazówka:\s*Sprawdź:\s*login\/hasło SQL[\s\S]*$/i, "")
    .replace(/\s*Wskazówka:\s*Sprawdź:\s*login\/hasło SQL[\s\S]*$/i, "")
    .trim();

  return {
    title: /HRESULT|0x[0-9a-fA-F]{8}|InsERT|Sfera/i.test(raw)
      ? "Błąd Sfery Subiekta"
      : "Błąd Subiekta",
    message:
      withoutMisleadingHint ||
      "Sfera Subiekta niedostępna lub zajęta. Spróbuj za chwilę.",
  };
}
