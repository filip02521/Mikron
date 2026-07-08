/** Ponowienia gdy serwerowe send_at jest jeszcze w przyszłości (skew zegara / opóźnienie sieci). */
export const NOTIFICATION_FLUSH_RETRY_MS = 1_500;
export const NOTIFICATION_FLUSH_MAX_ATTEMPTS = 10;

export function shouldRetryNotificationFlush(sent: number, attempt: number): boolean {
  return sent === 0 && attempt < NOTIFICATION_FLUSH_MAX_ATTEMPTS;
}
