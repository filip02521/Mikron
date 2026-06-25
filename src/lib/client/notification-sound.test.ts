/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isNotificationSoundUnlocked,
  playPopNotificationSound,
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
      currentTime = 0;
      play = play;
      pause = vi.fn();
    }
    vi.stubGlobal("Audio", AudioMock as unknown as typeof Audio);

    await expect(playPopNotificationSound()).resolves.toBe(false);
    expect(play).not.toHaveBeenCalled();
    expect(isNotificationSoundUnlocked()).toBe(false);
  });

  it("odtwarza po udanym odblokowaniu gestem", async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    class AudioMock {
      preload = "";
      volume = 1;
      currentTime = 0;
      play = play;
      pause = vi.fn();
    }
    vi.stubGlobal("Audio", AudioMock as unknown as typeof Audio);

    await expect(unlockNotificationSound()).resolves.toBe(true);
    expect(isNotificationSoundUnlocked()).toBe(true);

    await expect(playPopNotificationSound()).resolves.toBe(true);
    expect(play).toHaveBeenCalledTimes(2);
  });
});
