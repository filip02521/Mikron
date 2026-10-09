/**
 * Treść przekazywanej rozmowy: każda wiadomość jak w „Przekaż dalej” programu pocztowego
 * (od kogo, kiedy, temat, treść), od najstarszej. Odbiorca widzi, o co chodzi, bez szukania w Gmailu.
 */

const whenFmt = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Łącznie nie więcej — mail przekazany do magazynu czy księgowości ma być do przeczytania, nie archiwum. */
const MAX_TOTAL = 30_000;

export type ForwardedMessage = {
  from_name: string;
  from_address: string;
  subject: string;
  snippet: string;
  received_at: Date;
  text: string | null;
};

export function forwardedConversationText(messages: readonly ForwardedMessage[]): string {
  const blocks = [...messages]
    .sort((a, b) => a.received_at.getTime() - b.received_at.getTime())
    .map((m) =>
      [
        "---------- Przekazana wiadomość ----------",
        `Od: ${m.from_name ? `${m.from_name} <${m.from_address}>` : m.from_address}`,
        `Data: ${whenFmt.format(m.received_at)}`,
        `Temat: ${m.subject || "(bez tematu)"}`,
        "",
        (m.text ?? m.snippet).trim(),
      ].join("\n")
    );
  const text = blocks.join("\n\n");
  return text.length > MAX_TOTAL ? `${text.slice(0, MAX_TOTAL)}…` : text;
}
