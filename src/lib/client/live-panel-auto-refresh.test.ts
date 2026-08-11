import { describe, expect, it } from "vitest";
import {
  isOperationsPrimaryLiveRefreshPath,
  isTeethPrimaryLiveRefreshPath,
  LIVE_PANEL_AUTO_REFRESH_COOLDOWN_MS,
  shouldFireLivePanelAutoRefresh,
} from "@/lib/client/live-panel-auto-refresh";

describe("live-panel-auto-refresh", () => {
  describe("shouldFireLivePanelAutoRefresh", () => {
    it("odpala przy pierwszym wywołaniu", () => {
      const r = shouldFireLivePanelAutoRefresh({ lastFiredAt: 0, now: 1000 });
      expect(r.fire).toBe(true);
      expect(r.nextFiredAt).toBe(1000);
    });

    it("blokuje w oknie cooldown", () => {
      const last = 10_000;
      const r = shouldFireLivePanelAutoRefresh({
        lastFiredAt: last,
        now: last + LIVE_PANEL_AUTO_REFRESH_COOLDOWN_MS - 1,
      });
      expect(r.fire).toBe(false);
      expect(r.nextFiredAt).toBe(last);
    });

    it("odpala po cooldownie", () => {
      const last = 10_000;
      const now = last + LIVE_PANEL_AUTO_REFRESH_COOLDOWN_MS;
      const r = shouldFireLivePanelAutoRefresh({ lastFiredAt: last, now });
      expect(r.fire).toBe(true);
      expect(r.nextFiredAt).toBe(now);
    });
  });

  describe("isOperationsPrimaryLiveRefreshPath", () => {
    it("obejmuje panel dzienny, weryfikację i tablicę zakupów", () => {
      expect(isOperationsPrimaryLiveRefreshPath("/podsumowanie")).toBe(true);
      expect(isOperationsPrimaryLiveRefreshPath("/weryfikacja")).toBe(true);
      expect(isOperationsPrimaryLiveRefreshPath("/zakupy/tablica")).toBe(true);
      expect(isOperationsPrimaryLiveRefreshPath("/zakupy/tablica/foo")).toBe(true);
    });

    it("nie obejmuje kolejki / dostaw / historii / podsumowania miesiąca", () => {
      expect(isOperationsPrimaryLiveRefreshPath("/kolejka")).toBe(false);
      expect(isOperationsPrimaryLiveRefreshPath("/dostawy")).toBe(false);
      expect(isOperationsPrimaryLiveRefreshPath("/historia")).toBe(false);
      expect(isOperationsPrimaryLiveRefreshPath("/podsumowanie-miesieczne")).toBe(
        false
      );
      expect(isOperationsPrimaryLiveRefreshPath(null)).toBe(false);
    });
  });

  describe("isTeethPrimaryLiveRefreshPath", () => {
    it("obejmuje całe /zeby/*", () => {
      expect(isTeethPrimaryLiveRefreshPath("/zeby")).toBe(true);
      expect(isTeethPrimaryLiveRefreshPath("/zeby/kolejka")).toBe(true);
      expect(isTeethPrimaryLiveRefreshPath("/podsumowanie")).toBe(false);
    });
  });
});
