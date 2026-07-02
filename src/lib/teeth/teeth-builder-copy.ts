import type { TeethKind, TeethProductLine } from "@/lib/teeth/teeth-catalog";
import { TEETH_KIND_LABELS, teethProductLineLabel } from "@/lib/teeth/teeth-catalog";
import type { TeethJawMode } from "@/lib/teeth/teeth-mould-shape-groups";

export const TEETH_SECTION_LABELS = TEETH_KIND_LABELS;
export const TEETH_DUAL_KIND_LABELS = TEETH_KIND_LABELS;

export const TEETH_SINGLE_MODAL_TITLE_HINT_DEFAULT =
  "Uzupełnij listę z kartki klienta. U przodów fason koduje szczękę (np. dolne kody 00–011); u boków wybierz szczękę — „Oba” tworzy dwie pozycje.";

/** Podpowiedź w nagłówku modala listy — zależna od linii produktowej. */
export function teethSingleModalTitleHint(productLine?: TeethProductLine | null): string {
  if (productLine === "ivoclar_phonares_ii") {
    return "Phonares II: przody Soft (S*) / Bold (B*) / dolne L* — bez wyboru szczęki. Boki Typ (NU/NL) lub Lingual (LU/LL) — „Oba” tworzy parę góra/dół.";
  }
  if (productLine === "ivoclar_vivodent_dcl") {
    return "Vivodent S DCL: przody trójkątne / owalne / kwadratowe lub dolne A3–A10 — bez pola szczęki. W trybie dual uzupełnij też boki Orthotyp.";
  }
  if (productLine === "ivoclar_orthotyp_dcl") {
    return "Orthotyp S DCL: boki Orthotyp (N*U/N*L) lub Lingual (LU*/LL*) — wybierz szczękę; „Oba” tworzy parę góra/dół.";
  }
  return TEETH_SINGLE_MODAL_TITLE_HINT_DEFAULT;
}

/** @deprecated Użyj {@link teethSingleModalTitleHint}. */
export const TEETH_SINGLE_MODAL_TITLE_HINT = TEETH_SINGLE_MODAL_TITLE_HINT_DEFAULT;

export const TEETH_DUAL_CARD_HINT =
  "W jednym oknie uzupełnisz przednie i boczne — przełącz typ w modalu listy. Pozycje w prośbie powstaną automatycznie.";

export const TEETH_DUAL_EMPTY_SECTIONS =
  "Dodaj co najmniej jedną pozycję — wybierz typ Przednie lub Boczne i uzupełnij listę.";

export const TEETH_DUAL_MODAL_TITLE_HINT =
  "Przełącz typ i uzupełnij listy z kartki — u przodów bez pola szczęki, u boków „Oba” tworzy dwie pozycje.";

export const TEETH_BUILDER_BOTH_JAW_HINT =
  "„Oba” doda dwie pozycje na liście (góra i dół) z tą samą ilością.";

export const TEETH_BUILDER_EMPTY_LIST_TITLE = "Brak pozycji na liście";

export function teethBuilderEmptyListExample(
  kind: TeethKind,
  productLine?: TeethProductLine | null,
): string {
  if (productLine === "wiedent_estetic" && kind === "anterior") {
    return "Dodaj pierwszą pozycję — np. A2 · 32 × 4 szt.";
  }
  if (productLine === "wiedent_classic" && kind === "anterior") {
    return "Dodaj pierwszą pozycję — np. A2 · 402 × 4 szt.";
  }
  if (productLine === "wiedent_almamiss" && kind === "anterior") {
    return "Dodaj pierwszą pozycję — np. A2 · 210 × 4 szt.";
  }
  if (productLine === "dentex_amberlux" && kind === "anterior") {
    return "Dodaj pierwszą pozycję — np. A2 · 3 × 4 szt.";
  }
  if (productLine === "major_super_lux" && kind === "anterior") {
    return "Dodaj pierwszą pozycję — np. A2 · 50 × 4 szt.";
  }
  if (productLine === "ivoclar_phonares_ii" && kind === "anterior") {
    return "Dodaj pierwszą pozycję — np. A2 · S61 × 4 szt. (Soft) lub L50 (dolne).";
  }
  if (productLine === "ivoclar_phonares_ii" && kind === "posterior") {
    return "Dodaj pierwszą pozycję — np. A2 · NU5 · góra × 2 szt. (Typ) lub LU5 (Lingual).";
  }
  if (productLine === "ivoclar_vivodent_dcl" && kind === "anterior") {
    return "Dodaj pierwszą pozycję — np. A2 · A25 × 4 szt. (owalne) lub A7 (dolne).";
  }
  if (productLine === "ivoclar_orthotyp_dcl" && kind === "posterior") {
    return "Dodaj pierwszą pozycję — np. A2 · N5U · góra × 2 szt. (Orthotyp) lub LU5 (Lingual).";
  }
  if (kind === "anterior") {
    return "Dodaj pierwszą pozycję — np. A2 · S61 × 4 szt.";
  }
  return "Dodaj pierwszą pozycję — np. A2 · 60 · góra × 2 szt.";
}

export type TeethDualSectionStatus = { hasItems: boolean; complete: boolean };

export type TeethBuilderStep = {
  number: number;
  label: string;
  done: boolean;
};

export function teethBuilderJawStepDone(
  jawMode: TeethJawMode | null | undefined,
  jaw: "upper" | "lower" | null | undefined,
): boolean {
  return (
    jawMode === "both" ||
    jawMode === "upper" ||
    jawMode === "lower" ||
    jaw === "upper" ||
    jaw === "lower"
  );
}

export function teethBuilderSteps(input: {
  kind: TeethKind | null;
  color: string;
  mould: string | null | undefined;
  jawMode?: TeethJawMode | null;
  jaw?: "upper" | "lower" | null;
  includeKindStep?: boolean;
  kindSelected?: boolean;
}): TeethBuilderStep[] {
  const steps: TeethBuilderStep[] = [];
  let n = 1;

  if (input.includeKindStep) {
    steps.push({ number: n++, label: "Typ", done: input.kindSelected ?? !!input.kind });
  }

  steps.push({ number: n++, label: "Kolor", done: !!input.color.trim() });
  steps.push({ number: n++, label: "Kształt · fason", done: !!input.mould?.trim() });

  if (input.kind === "posterior") {
    steps.push({
      number: n++,
      label: "Szczęka",
      done: teethBuilderJawStepDone(input.jawMode, input.jaw),
    });
  }

  steps.push({ number: n, label: "Ilość", done: false });
  return steps;
}

export function teethBuilderQuantityStepNumber(kind: TeethKind | null): number {
  return kind === "posterior" ? 4 : 3;
}

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
