/** Błędy transportu server action — zapis mógł się udać mimo komunikatu w UI. */
const TRANSPORT_MESSAGE_PATTERNS = [
  /unexpected response was received from the server/i,
  /failed to fetch/i,
  /network error/i,
  /load failed/i,
  /networkrequestfailed/i,
  /aborted/i,
  /econnreset/i,
];

export function isServerActionTransportError(error: unknown): boolean {
  if (!error) return false;

  const message = error instanceof Error ? error.message : String(error);
  if (TRANSPORT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
    return true;
  }

  if (typeof error === "object" && error != null) {
    const digest = String((error as Record<string, unknown>).digest ?? "");
    if (digest.includes("E394")) return true;
  }

  const code =
    typeof error === "object" && error != null
      ? String((error as Record<string, unknown>).code ?? "")
      : "";
  return code === "E394";
}
