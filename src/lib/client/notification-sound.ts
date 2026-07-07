const BOARD_QUESTION_SOUND_SRC = "/sounds/pop3.mp3";
const BOARD_QUESTION_SOUND_VOLUME = 0.55;
const TOAST_SOUND_SRC = "/sounds/pop2.mp3";
const TOAST_SOUND_VOLUME = 0.7;

let primeAudio: HTMLAudioElement | null = null;
let unlocked = false;
let lastBoardSoundAt = 0;
const BOARD_SOUND_DEBOUNCE_MS = 800;

function createClip(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  const clip = new Audio(BOARD_QUESTION_SOUND_SRC);
  clip.preload = "auto";
  clip.volume = BOARD_QUESTION_SOUND_VOLUME;
  return clip;
}

function getPrimeAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  primeAudio = primeAudio ?? createClip();
  return primeAudio;
}

/** Odblokuj odtwarzanie w handlerze gestu użytkownika (polityka autoplay). */
export async function unlockNotificationSound(): Promise<boolean> {
  if (unlocked || typeof window === "undefined") return unlocked;
  const clip = getPrimeAudio();
  if (!clip) return false;

  try {
    clip.volume = BOARD_QUESTION_SOUND_VOLUME;
    clip.currentTime = 0;
    await clip.play();
    clip.pause();
    clip.currentTime = 0;
    unlocked = true;
    return true;
  } catch {
    return false;
  }
}

export function isNotificationSoundUnlocked(): boolean {
  return unlocked;
}

export async function playPopNotificationSound(): Promise<boolean> {
  if (typeof window === "undefined" || !unlocked) return false;
  const now = Date.now();
  if (now - lastBoardSoundAt < BOARD_SOUND_DEBOUNCE_MS) return false;
  lastBoardSoundAt = now;

  try {
    const clip = createClip();
    if (!clip) return false;
    clip.currentTime = 0;
    await clip.play();
    return true;
  } catch {
    return false;
  }
}

/** Odtwórz dźwięk toast/undo (pop2.mp3). Wymaga wcześniejszego unlock. */
let lastToastSoundAt = 0;
const TOAST_SOUND_DEBOUNCE_MS = 800;

export async function playToastNotificationSound(): Promise<boolean> {
  if (typeof window === "undefined" || !unlocked) return false;
  const now = Date.now();
  if (now - lastToastSoundAt < TOAST_SOUND_DEBOUNCE_MS) return false;
  lastToastSoundAt = now;

  try {
    const clip = new Audio(TOAST_SOUND_SRC);
    clip.preload = "auto";
    clip.volume = TOAST_SOUND_VOLUME;
    clip.currentTime = 0;
    await clip.play();
    return true;
  } catch {
    return false;
  }
}

/** Test hook — reset stanu między testami. */
export function resetNotificationSoundForTests(): void {
  if (primeAudio) {
    primeAudio.pause();
    primeAudio.src = "";
  }
  primeAudio = null;
  unlocked = false;
  lastBoardSoundAt = 0;
  lastToastSoundAt = 0;
}
