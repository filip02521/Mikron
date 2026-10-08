/**
 * Raporty automatycznych kontroli prowadzonych poza OnTime (rutyny Claude w chmurze).
 * Linki są prywatne, więc trzymamy je w env serwera, nie w repozytorium.
 * Docelowo wyniki mają trafiać do bazy OnTime (docs/plans/asystent-kontrola-oc.md).
 */

export type AssistantReport = {
  key: "inbox" | "orderConfirmations";
  title: string;
  description: string;
  schedule: string;
  envVar: string;
  url: string | null;
};

const REPORTS: Omit<AssistantReport, "url">[] = [
  {
    key: "inbox",
    title: "Poranny przegląd skrzynki",
    description:
      "Co wymaga odpowiedzi, dostawy na dziś i jutro, faktury i sprawy do wiadomości z maili działu zakupów.",
    schedule: "pn–pt 7:14",
    envVar: "ASSISTANT_INBOX_REPORT_URL",
  },
  {
    key: "orderConfirmations",
    title: "Kontrola potwierdzeń zamówień (OC)",
    description:
      "Potwierdzenia, pro-formy i PI od dostawców porównane pozycja po pozycji z wysłanym ZD: ilości, jednostki, terminy, braki i pozycje dodatkowe.",
    schedule: "pn–pt 9:07, 11:07, 13:07, 15:07",
    envVar: "ASSISTANT_OC_REPORT_URL",
  },
];

/** Przyjmujemy tylko https, żeby z env nie dało się wstrzyknąć javascript: ani http do podmiany. */
function safeHttpsUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function assistantReports(
  env: Record<string, string | undefined> = process.env
): AssistantReport[] {
  return REPORTS.map((report) => ({ ...report, url: safeHttpsUrl(env[report.envVar]) }));
}
