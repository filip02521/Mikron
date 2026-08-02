/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isNotificationSoundUnlocked,
  playPopNotificationSound,
  playToastNotificationSound,
  resetNotificationSoundForTests,
  unlockNotificationSound,
} from "./notification-sound";

describe("notification-sound", () => {
  afterEach(() => {
    resetNotificationSoundForTests();
    vi.unstubAllGlobals();
  });

  it("nie odtwarza przed odblokowaniem autoplay", async () => {
    const play = vi.fn().mockRejectedValue(new Error("blocked"));
    class AudioMock {
      preload = "";
      volume = 1;
      muted = false;
      currentTime = 0;
      play = play;
      pause = vi.fn();
    }
    vi.stubGlobal("Audio", AudioMock as unknown as typeof Audio);

    await expect(playPopNotificationSound()).resolves.toBe(false);
    expect(play).not.toHaveBeenCalled();
    expect(isNotificationSoundUnlocked()).toBe(false);
  });

  it("odblokowuje prawie ciszą (volume ≈ 0), a potem gra głośno", async () => {
    const volumes: number[] = [];
    const play = vi.fn().mockImplementation(function (this: { volume: number }) {
      volumes.push(this.volume);
      return Promise.resolve(undefined);
    });
    class AudioMock {
      preload = "";
      volume = 1;
      muted = false;
      currentTime = 0;
      play = play;
      pause = vi.fn();
    }
    vi.stubGlobal("Audio", AudioMock as unknown as typeof Audio);

    await expect(unlockNotificationSound()).resolves.toBe(true);
    expect(isNotificationSoundUnlocked()).toBe(true);
    expect(volumes[0]).toBeLessThanOrEqual(0.001);

    await expect(playPopNotificationSound()).resolves.toBe(true);
    expect(play).toHaveBeenCalledTimes(2);
    expect(volumes[1]).toBeGreaterThan(0.1);
  });

  it("toast też wymaga unlock", async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    class AudioMock {
      preload = "";
      volume = 1;
      muted = false;
      currentTime = 0;
      play = play;
      pause = vi.fn();
    }
    vi.stubGlobal("Audio", AudioMock as unknown as typeof Audio);

    await expect(playToastNotificationSound()).resolves.toBe(false);
    expect(play).not.toHaveBeenCalled();

    await unlockNotificationSound();
    await expect(playToastNotificationSound()).resolves.toBe(true);
    expect(play).toHaveBeenCalled();
  });

  it("toast respektuje mute z localStorage", async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    class AudioMock {
      preload = "";
      volume = 1;
      muted = false;
      currentTime = 0;
      play = play;
      pause = vi.fn();
    }
    vi.stubGlobal("Audio", AudioMock as unknown as typeof Audio);
    localStorage.setItem("toast-notification-sound-muted", "1");

    await unlockNotificationSound();
    await expect(playToastNotificationSound()).resolves.toBe(false);
    expect(play).toHaveBeenCalledTimes(1); // tylko unlock

    localStorage.setItem("toast-notification-sound-muted", "0");
    await expect(playToastNotificationSound()).resolves.toBe(true);
  });
});
