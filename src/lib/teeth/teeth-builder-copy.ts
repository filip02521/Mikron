import type { TeethKind, TeethProductLine } from "@/lib/teeth/teeth-catalog";
import { TEETH_KIND_LABELS, teethProductLineLabel } from "@/lib/teeth/teeth-catalog";

export const TEETH_SECTION_LABELS = TEETH_KIND_LABELS;
/** Etykiety przełącznika typu w modalu listy zębów. */
export const TEETH_DUAL_KIND_LABELS = TEETH_KIND_LABELS;

export const TEETH_DUAL_CARD_HINT =
  "W jednym oknie uzupełnisz przednie i boczne — przełącz typ w modalu listy. Pozycje w prośbie powstaną automatycznie.";

export const TEETH_DUAL_EMPTY_SECTIONS =
  "Dodaj co najmniej jedną pozycję — wybierz typ Przednie lub Boczne i uzupełnij listę.";

export const TEETH_DUAL_MODAL_TITLE_HINT =
  "Przełącz typ i uzupełnij listy z kartki — wystarczy jeden lub oba.";

export type TeethDualSectionStatus = { hasItems: boolean; complete: boolean };

export function teethDualSaveReady(
  anterior: TeethDualSectionStatus,
  posterior: TeethDualSectionStatus,
): boolean {
  if (!anterior.hasItems && !posterior.hasItems) return false;
  if (anterior.hasItems && !anterior.complete) return false;
  if (posterior.hasItems && !posterior.complete) return false;
  return true;
}

export function teethDualSaveBlockReason(
  anterior: TeethDualSectionStatus,
  posterior: TeethDualSectionStatus,
): string | null {
  if (teethDualSaveReady(anterior, posterior)) return null;
  if (!anterior.hasItems && !posterior.hasItems) return TEETH_DUAL_EMPTY_SECTIONS;
  if (anterior.hasItems && !anterior.complete) {
    return teethDualIncompleteSectionMessage("anterior");
  }
  if (posterior.hasItems && !posterior.complete) {
    return teethDualIncompleteSectionMessage("posterior");
  }
  return null;
}

export function teethDualIncompleteSectionMessage(kind: TeethKind): string {
  return `Uzupełnij wszystkie pozycje na liście typu ${TEETH_DUAL_KIND_LABELS[kind]}.`;
}

export function teethDualMissingRegistryProductMessage(
  kind: TeethKind,
  productLine: TeethProductLine,
): string {
  const lineLabel = teethProductLineLabel(productLine) ?? productLine;
  const kindLabel = TEETH_KIND_LABELS[kind].toLowerCase();
  return `Brak zarejestrowanego towaru Subiekta dla zębów ${kindLabel} w linii ${lineLabel}. Uzupełnij parę w Administracja → Produkty zębowe.`;
}

export const TEETH_DUAL_LINE_LIMIT_MESSAGE =
  "Nie można dodać drugiej pozycji — osiągnięto limit pozycji w jednej prośbie.";

export function teethDualSavePreviewMessage(
  anteriorCount: number,
  posteriorCount: number,
): string | null {
  const parts: string[] = [];
  if (anteriorCount > 0) {
    parts.push(`${anteriorCount} przednich`);
  }
  if (posteriorCount > 0) {
    parts.push(`${posteriorCount} bocznych`);
  }
  if (parts.length === 0) return null;
  const positionCount = (anteriorCount > 0 ? 1 : 0) + (posteriorCount > 0 ? 1 : 0);
  return `Po zapisie powstaną ${positionCount} ${positionCount === 1 ? "pozycja" : positionCount < 5 ? "pozycje" : "pozycji"} w prośbie (${parts.join(", ")}).`;
}

export function teethDualCommitToastMessage(
  added: Array<{ kind: TeethKind; product: string; quantity: number }>,
  updated: Array<{ kind: TeethKind; quantity: number }>,
): string {
  const sentences: string[] = [];
  for (const item of added) {
    const label = TEETH_DUAL_KIND_LABELS[item.kind].toLowerCase();
    sentences.push(
      `Dodano pozycję (${label}) do prośby: ${item.product} · ${item.quantity} szt.`,
    );
  }
  for (const item of updated) {
    const label = TEETH_DUAL_KIND_LABELS[item.kind].toLowerCase();
    sentences.push(`Zaktualizowano ${label}: ${item.quantity} szt.`);
  }
  return sentences.join(" ");
}
