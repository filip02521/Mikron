/**
 * Policz, krok 1 (klient): pytaj o profil sprzedaży, aż przestanie się liczyć.
 * Każde pytanie to krótkie żądanie — długie liczenie profilu (cecha Ivoclar ~3 min) nie
 * trzyma już jednego żądania razem z listą ponad limit 5 min nginx. Import: tylko klient.
 */
import type { ZdSalesProfilePrepareStatus } from "@/lib/orders/zd-sales-profile-load";

export const ZD_PROFILE_PREPARE_POLL_MS = 3_000;
/** Po tym czasie liczymy listę mimo wszystko — silnik ma własny bezpiecznik (limit + komunikat). */
export const ZD_PROFILE_PREPARE_MAX_WAIT_MS = 8 * 60_000;

/** "continue" = licz listę (krok 2); "cancelled" = użytkownik zaczął inne liczenie. */
export async function waitForZdSalesProfile(opts: {
  prepare: () => Promise<ZdSalesProfilePrepareStatus>;
  isCancelled: () => boolean;
  /** Profil się liczy — pokaż to na ekranie postępu. */
  onComputing?: () => void;
  pollMs?: number;
  maxWaitMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<"continue" | "cancelled"> {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const started = now();
  while (true) {
    if (opts.isCancelled()) return "cancelled";
    let state: ZdSalesProfilePrepareStatus;
    try {
      state = await opts.prepare();
    } catch {
      // Sieć / sesja — krok 2 zgłosi błąd czytelnie; tu nie blokujemy.
      return "continue";
    }
    if (opts.isCancelled()) return "cancelled";
    // "failed": krok 2 spróbuje sam (bezpiecznik silnika) i pokaże komunikat.
    if (state.status !== "computing") return "continue";
    opts.onComputing?.();
    if (now() - started >= (opts.maxWaitMs ?? ZD_PROFILE_PREPARE_MAX_WAIT_MS)) return "continue";
    await sleep(opts.pollMs ?? ZD_PROFILE_PREPARE_POLL_MS);
  }
}
