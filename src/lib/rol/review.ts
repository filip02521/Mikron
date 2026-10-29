/**
 * Przegląd paczki ROL (plasterek 3): co wolno zmienić w którym stanie, kiedy da się zatwierdzić listę,
 * walidacja ilości i numeru katalogowego. Czyste reguły — zapis w `data.ts`, granica zaufania w akcjach.
 */
import { polishPlural } from "@/lib/email/polish-plural";
import { ROL_ASSIGNED_HERE_REASON, ROL_CONFLICT_REASON } from "./constants";
import type { RolBatchStatus } from "./merge";
import { rolActiveLines, rolBatchBlockers } from "./view";
import type { RolInvoiceView, RolLineView } from "./data";

/** Lista jest edytowalna tylko przed zatwierdzeniem; po zatwierdzeniu najpierw „Edytuj listę”. */
export function rolBatchEditable(status: RolBatchStatus): boolean {
  return status === "wykryte";
}

export function rolApproveError(batch: {
  status: RolBatchStatus;
  invoices: readonly RolInvoiceView[];
  lines: readonly RolLineView[];
}): string | null {
  if (batch.status !== "wykryte") return "Tę listę już zatwierdzono albo wysłano — odśwież stronę.";
  const blockers = rolBatchBlockers(batch);
  if (blockers.length) return `Najpierw popraw: ${blockers.join(", ")}.`;
  if (!rolActiveLines(batch).length) return "Na liście nie ma żadnej pozycji do zgłoszenia.";
  return null;
}

export function rolReopenError(status: RolBatchStatus): string | null {
  return status === "przejrzane" ? null : "Edytować można tylko listę zatwierdzoną, a jeszcze niewysłaną.";
}

/** Ilość ręczna: pusta = wróć do ilości z FS; inaczej liczba ≥ 0 z najwyżej 3 miejscami po przecinku. */
export function parseRolQtyOverride(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const s = raw.trim().replace(",", ".");
  if (!s) return { ok: true, value: null };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 100_000 || Math.round(n * 1000) !== n * 1000) {
    return { ok: false, error: "Ilość musi być liczbą od 0 wzwyż (np. 2 albo 1,5)." };
  }
  return { ok: true, value: n };
}

export function parseRolCatalogNo(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const s = raw.trim();
  return /^\d{6}$/.test(s) ? { ok: true, value: s } : { ok: false, error: "Numer katalogowy Ivoclar to 6 cyfr, np. 764338." };
}

/** Powód wyłączenia FS przypisanej innemu klientowi ROL przy rozstrzygnięciu konfliktu. */
export function rolAssignedElsewhereReason(otherLabel: string): string {
  return `Przypisana do ROL ${otherLabel}`;
}

/**
 * Po ponownym skanie wygrywa tylko jawna decyzja użytkownika o FS: wyłączenie albo przypisanie konfliktu
 * do tego klienta. Stan domyślny i automatyczny znacznik konfliktu liczy skan od nowa — inaczej nowy
 * konflikt na FS, która była już w paczce, zostałby po tej stronie przeoczony.
 */
export function rolInvoiceAfterRescan(
  prev: { excluded: boolean; excludedReason: string } | undefined,
  draft: { excluded: boolean; excludedReason: string }
): { excluded: boolean; excludedReason: string } {
  if (!prev || prev.excludedReason === ROL_CONFLICT_REASON) return draft;
  if (prev.excluded || prev.excludedReason === ROL_ASSIGNED_HERE_REASON) {
    return { excluded: prev.excluded, excludedReason: prev.excludedReason };
  }
  return draft;
}

/** Ile pozycji/FS zmienił użytkownik — do zdania w wierszu klienta. */
export function rolEditSummary(batch: { invoices: readonly RolInvoiceView[]; lines: readonly RolLineView[] }): string {
  const fs = batch.invoices.filter((i) => i.excluded && i.excludedReason !== ROL_CONFLICT_REASON).length;
  const lines = batch.lines.filter((l) => l.excluded || l.qtyOverride !== null).length;
  const parts: string[] = [];
  if (fs) parts.push(`${polishPlural(fs, "FS wyłączona", "FS wyłączone", "FS wyłączonych")}`);
  if (lines) parts.push(`${polishPlural(lines, "pozycja zmieniona", "pozycje zmienione", "pozycji zmienionych")}`);
  return parts.join(" · ");
}
