import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_FLUSH_MAX_ATTEMPTS,
  shouldRetryNotificationFlush,
} from "@/lib/client/delivery-notification-flush-retry";

describe("delivery-notification-flush-retry", () => {
  it("ponawia gdy serwer jeszcze nie wysłał (sent === 0)", () => {
    expect(shouldRetryNotificationFlush(0, 0)).toBe(true);
    expect(shouldRetryNotificationFlush(0, NOTIFICATION_FLUSH_MAX_ATTEMPTS - 1)).toBe(true);
    expect(shouldRetryNotificationFlush(0, NOTIFICATION_FLUSH_MAX_ATTEMPTS)).toBe(false);
  });

  it("kończy po udanym wysłaniu", () => {
    expect(shouldRetryNotificationFlush(1, 0)).toBe(false);
  });
});
