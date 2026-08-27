/**
 * Flash toast po udanym wysłaniu prośby z ZK — sessionStorage + sticky handoff
 * w pamięci modułu (nawigacja unmountuje OrderFormClient; Strict Mode w dev
 * odpala effect 2× i zjada jednorazowy consume z samego storage).
 */
import type { AutoProsbaToastPayload } from "@/lib/sales/zk-watch-auto-prosba-copy";
import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";
import { formatSubmitResult } from "@/lib/orders/prosba-submit-result-copy";
import type { IndividualRequestKind } from "@/types/database";
import { plPozycja } from "@/lib/ui/polish-plurals";

export const PROSBA_SUCCESS_FLASH_STORAGE_KEY = "ontime-prosba-success-flash";

export type ProsbaSuccessFlash = {
  title: string;
  message: string;
  tone: "success" | "warning" | "error";
  actionHref?: string;
  actionLabel?: string;
  zkWatchId?: string | null;
  zkNumber?: string | null;
  /** AutoProsbaResultCode gdy znany — UI toast może rozróżnić supplement/skipped. */
  code?: string;
  createdAt: number;
};

const FLASH_MAX_AGE_MS = 15 * 60_000;

type StickyHandoff = { flash: ProsbaSuccessFlash; reads: number };
let stickyHandoff: StickyHandoff | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function clearStorageOnly(): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.removeItem(PROSBA_SUCCESS_FLASH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function readStorageRaw(): ProsbaSuccessFlash | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(PROSBA_SUCCESS_FLASH_STORAGE_KEY);
    if (!raw) return null;
    return parseFlash(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function buildZkProsbaSuccessFlash(input: {
  zkNumber: string;
  zkWatchId?: string | null;
  count: number;
  complete: number;
  verification: number;
  requestKind: IndividualRequestKind;
  mode?: "full" | "supplement";
  actionHref?: string;
  actionLabel?: string;
  code?: string;
}): ProsbaSuccessFlash {
  const zkLabel = formatZkWatchDisplayNumber(input.zkNumber) || input.zkNumber.trim();
  const countLabel =
    input.count === 1
      ? "1 pozycja"
      : `${input.count} ${plPozycja(input.count)}`;
  const modeBit = input.mode === "supplement" ? " uzupełniająca" : "";

  const detail = formatSubmitResult(
    {
      count: input.count,
      complete: input.complete,
      verification: input.verification,
    },
    input.requestKind,
    true
  ).trim();
  // Unikaj „Prośba zapisana. Prośba zapisana.” — krótki sukces zostaje w tytule.
  const detailUseful = detail.length > 0 && !/^prośba zapisana\.?$/i.test(detail);

  const code =
    input.code ??
    (input.mode === "supplement" ? "created_supplement" : "created");

  return {
    title: "Prośba zapisana",
    message: detailUseful
      ? `Prośba${modeBit} powiązana z ZK ${zkLabel} (${countLabel}). ${detail}`
      : `Prośba${modeBit} powiązana z ZK ${zkLabel} (${countLabel}).`,
    tone: "success",
    actionHref: input.actionHref,
    actionLabel: input.actionLabel ?? "Prośby tego klienta",
    zkWatchId: input.zkWatchId?.trim() || null,
    zkNumber: input.zkNumber.trim() || null,
    code,
    createdAt: Date.now(),
  };
}

/** Zawsze true gdy flash jest w pamięci — storage to bonus na hard reload. */
export function stashProsbaSuccessFlash(flash: ProsbaSuccessFlash): boolean {
  stickyHandoff = { flash, reads: 0 };
  if (!canUseStorage()) return true;
  try {
    window.sessionStorage.setItem(
      PROSBA_SUCCESS_FLASH_STORAGE_KEY,
      JSON.stringify(flash)
    );
    return true;
  } catch {
    return true;
  }
}

function parseFlash(raw: unknown): ProsbaSuccessFlash | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const message = typeof o.message === "string" ? o.message.trim() : "";
  const tone =
    o.tone === "success" || o.tone === "warning" || o.tone === "error"
      ? o.tone
      : null;
  const createdAt = Number(o.createdAt);
  if (!title || !message || !tone || !Number.isFinite(createdAt)) return null;
  if (Date.now() - createdAt > FLASH_MAX_AGE_MS) return null;
  return {
    title,
    message,
    tone,
    actionHref: typeof o.actionHref === "string" ? o.actionHref : undefined,
    actionLabel: typeof o.actionLabel === "string" ? o.actionLabel : undefined,
    zkWatchId: typeof o.zkWatchId === "string" ? o.zkWatchId : null,
    zkNumber: typeof o.zkNumber === "string" ? o.zkNumber : null,
    code: typeof o.code === "string" ? o.code : undefined,
    createdAt,
  };
}

/** Odczyt bez kasowania — do debug / testów. */
export function peekProsbaSuccessFlash(): ProsbaSuccessFlash | null {
  if (
    stickyHandoff &&
    Date.now() - stickyHandoff.flash.createdAt <= FLASH_MAX_AGE_MS
  ) {
    return stickyHandoff.flash;
  }
  return readStorageRaw();
}

/**
 * Jednorazowy odczyt z tolerancją Strict Mode:
 * 1. consume → oddaje flash, czyści storage, zostawia sticky na synchroniczny remount
 * 2. drugi consume (Strict) → oddaje ten sam flash i czyści sticky
 * 3. microtask po 1. odczycie czyści sticky, gdy nie było 2. (produkcja)
 */
export function consumeProsbaSuccessFlash(): ProsbaSuccessFlash | null {
  if (
    !stickyHandoff ||
    Date.now() - stickyHandoff.flash.createdAt > FLASH_MAX_AGE_MS
  ) {
    const stored = readStorageRaw();
    clearStorageOnly();
    if (!stored) {
      stickyHandoff = null;
      return null;
    }
    stickyHandoff = { flash: stored, reads: 0 };
  }

  stickyHandoff.reads += 1;
  const out = stickyHandoff.flash;
  clearStorageOnly();

  if (stickyHandoff.reads >= 2) {
    stickyHandoff = null;
  } else {
    const snapshot = stickyHandoff;
    queueMicrotask(() => {
      if (stickyHandoff === snapshot) stickyHandoff = null;
    });
  }
  return out;
}

export function clearProsbaSuccessFlash(): void {
  stickyHandoff = null;
  clearStorageOnly();
}

export function prosbaSuccessFlashToAutoToast(
  flash: ProsbaSuccessFlash
): AutoProsbaToastPayload {
  const code =
    flash.code === "created_supplement" ||
    flash.code === "created_with_skipped_lines" ||
    flash.code === "created_partial_verification" ||
    flash.code === "created"
      ? flash.code
      : "created";
  return {
    code,
    title: flash.title,
    message: flash.message,
    tone: flash.tone,
    actionHref: flash.actionHref,
    actionLabel: flash.actionLabel,
  };
}

/** Test-only. */
export function __resetProsbaSuccessFlashForTests(): void {
  stickyHandoff = null;
}
