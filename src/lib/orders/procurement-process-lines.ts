import { PROCUREMENT_PROCESS_LINES_COPY } from "@/lib/orders/procurement-process-lines-copy";

export type ProcurementProcessAction = "GLOWNE" | "POBOCZNE";

/** Modal wyboru linii tylko gdy w grupie jest więcej niż jedna pozycja. */
export function shouldPickLinesBeforeProcess(lineCount: number): boolean {
  return Number.isFinite(lineCount) && lineCount >= 2;
}

/**
 * Zaznaczone ID ∩ dostępne linie (kolejność jak na liście w modalu).
 * Odrzuca stale / obce id po odświeżeniu panelu.
 */
export function filterProcessLineIds(
  selectedIds: string[],
  availableIds: string[]
): string[] {
  const selected = new Set(
    selectedIds.map((id) => String(id ?? "").trim()).filter(Boolean)
  );
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of availableIds) {
    const id = String(raw ?? "").trim();
    if (!id || !selected.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function processLinesModalTitle(action: ProcurementProcessAction): string {
  return action === "GLOWNE"
    ? PROCUREMENT_PROCESS_LINES_COPY.titleGlowne
    : PROCUREMENT_PROCESS_LINES_COPY.titlePoboczne;
}

/** CTA: wszystkie → „Oznacz wszystkie (M)”; część → „Oznacz N z M”. */
export function processLinesConfirmLabel(
  selectedCount: number,
  totalCount: number
): string {
  const selected = Math.max(0, Math.trunc(selectedCount));
  const total = Math.max(0, Math.trunc(totalCount));
  if (total > 0 && selected >= total) {
    return `Oznacz wszystkie (${total})`;
  }
  return `Oznacz ${selected} z ${total}`;
}

export function processLinesSubtitle(
  supplierName: string,
  personName: string
): string {
  const supplier = supplierName.trim() || "Dostawca";
  const person = personName.trim() || "Handlowiec";
  return `${supplier} · ${person}`;
}

/** Ostrzeżenie o harmonogramie w modalu Główne. */
export function processLinesScheduleAlert(input: {
  action: ProcurementProcessAction;
  supplierOrderOnDemand: boolean;
  selectedCount: number;
  totalCount: number;
}): string | null {
  if (input.action !== "GLOWNE") return null;
  if (input.supplierOrderOnDemand) {
    return PROCUREMENT_PROCESS_LINES_COPY.scheduleAlertOnDemand;
  }
  const partial =
    input.totalCount > 0 && input.selectedCount < input.totalCount;
  if (partial) {
    return `${PROCUREMENT_PROCESS_LINES_COPY.scheduleAlert} ${PROCUREMENT_PROCESS_LINES_COPY.scheduleAlertPartial}`;
  }
  return PROCUREMENT_PROCESS_LINES_COPY.scheduleAlert;
}

export function processLinesSuccessToast(input: {
  action: ProcurementProcessAction;
  selectedCount: number;
  totalCount: number;
  supplierOrderOnDemand?: boolean;
}): string {
  const { action, selectedCount, totalCount } = input;
  const partial = totalCount > 0 && selectedCount < totalCount;
  const onDemand = input.supplierOrderOnDemand === true;

  if (action === "GLOWNE") {
    if (partial) {
      return onDemand
        ? `Oznaczono ${selectedCount} z ${totalCount} pozycji jako główne (bez terminu planowego)`
        : `Oznaczono ${selectedCount} z ${totalCount} pozycji jako zamówienie główne`;
    }
    return onDemand
      ? "Oznaczono jako główne (bez terminu planowego)"
      : "Oznaczono jako zamówienie główne";
  }

  if (partial) {
    return `Oznaczono ${selectedCount} z ${totalCount} pozycji jako uzupełniające`;
  }
  return "Oznaczono jako uzupełniające";
}

/** Title przycisku: dotychczasowy glowneTitle + hint pick gdy multi. */
export function processLinesButtonTitle(input: {
  canPickLines: boolean;
  baseTitle?: string | null;
}): string | undefined {
  const base = input.baseTitle?.trim() || null;
  if (!input.canPickLines) return base ?? undefined;
  if (base) {
    return `${base} ${PROCUREMENT_PROCESS_LINES_COPY.pickLinesHint}.`;
  }
  return PROCUREMENT_PROCESS_LINES_COPY.pickLinesHint;
}
