import {
  allTeethDetailsComplete,
  resolveTeethCatalogFromDraft,
  type TeethKind,
  type TeethLineDetail,
  type TeethManufacturer,
  type TeethProductLine,
} from "@/lib/teeth/teeth-catalog";
import { jawRequiredForKind } from "@/lib/teeth/teeth-mould-shape-groups";
import type { IndividualOrderTeethDetail } from "@/types/database";

export const TEETH_LIST_INCOMPLETE_MESSAGE =
  "Uzupełnij listę zębów (kolor, fason i typ; u boków także szczęka) przy każdej pozycji zębowej.";

export type TeethLineValidationInput = {
  teethDetails: TeethLineDetail[] | null | undefined;
  quantity: string;
  product?: string;
  subiektTwId?: number | null;
  adminProductLine?: TeethProductLine | null;
  adminManufacturer?: TeethManufacturer | null;
  isTeethProduct: boolean;
};

export function isMinimalTeethDetailRowComplete(
  detail: Pick<TeethLineDetail, "color" | "jaw" | "kind">
): boolean {
  const color = detail.color?.trim() ?? "";
  if (!color || !detail.kind) return false;
  if (jawRequiredForKind(detail.kind) && !detail.jaw) return false;
  return true;
}

function minimalTeethRowComplete(detail: TeethLineDetail): boolean {
  return isMinimalTeethDetailRowComplete(detail);
}

/** Czy lista zębów jest kompletna dla pozycji zębowej (zamówienie). */
export function teethLineDetailsComplete(input: TeethLineValidationInput): boolean {
  if (!input.isTeethProduct) return true;

  const catalog = resolveTeethCatalogFromDraft({
    adminProductLine: input.adminProductLine,
    teethProductLine: input.adminProductLine,
    teethManufacturer: input.adminManufacturer,
    product: input.product,
    subiektTwId: input.subiektTwId,
  });

  const detailsCount = input.teethDetails?.length ?? 0;
  if (detailsCount < 1) return false;

  const qty = parseInt(input.quantity, 10);
  if (Number.isFinite(qty) && qty > 0 && qty !== detailsCount) return false;

  if (!catalog) {
    return (input.teethDetails ?? [])
      .slice(0, detailsCount)
      .every((detail) => minimalTeethRowComplete(detail));
  }

  return allTeethDetailsComplete(input.teethDetails ?? undefined, catalog, detailsCount);
}

export function assertTeethLineDetailsComplete(
  input: TeethLineValidationInput,
  label?: string
): void {
  if (!teethLineDetailsComplete(input)) {
    throw new Error(label ? `${label}: ${TEETH_LIST_INCOMPLETE_MESSAGE}` : TEETH_LIST_INCOMPLETE_MESSAGE);
  }
}

export function enrichTeethDetailsForDisplay(
  details: IndividualOrderTeethDetail[] | null | undefined,
  adminKind?: TeethKind | null
): IndividualOrderTeethDetail[] | null {
  if (!details?.length) return details ?? null;
  if (!adminKind) return details;
  return details.map((detail) => ({
    ...detail,
    kind: detail.kind ?? adminKind,
  }));
}

export function normalizeTeethDetailsForSave(
  teethDetails: TeethLineDetail[] | null | undefined,
  adminKind?: TeethKind | null
): TeethLineDetail[] | null {
  if (!teethDetails?.length) return teethDetails ?? null;
  return teethDetails.map((detail) => ({
    ...detail,
    kind: detail.kind ?? adminKind ?? null,
  }));
}

/** Minimalna walidacja wiersza przed zapisem do bazy (gdy brak kontekstu katalogu). */
export function assertMinimalTeethDetailsForDb(
  teethDetails: TeethLineDetail[] | null | undefined
): void {
  if (!teethDetails?.length) {
    throw new Error(TEETH_LIST_INCOMPLETE_MESSAGE);
  }
  if (!teethDetails.every((detail) => minimalTeethRowComplete(detail))) {
    throw new Error(TEETH_LIST_INCOMPLETE_MESSAGE);
  }
}

export type TeethProductInfoLookup = {
  productLine: TeethProductLine | null;
  manufacturer: TeethManufacturer | null;
  kind: TeethKind | null;
};

export function assertTeethOrderLineIfApplicable(input: {
  requestKind: "zamowienie" | "informacja";
  subiektTwId?: number | null;
  quantity?: string;
  product?: string;
  teethDetails?: TeethLineDetail[] | null;
  teethTwIdSet: ReadonlySet<number>;
  teethInfoByTwId?: ReadonlyMap<number, TeethProductInfoLookup>;
  label?: string;
}): void {
  if (input.requestKind !== "zamowienie") return;
  const twId =
    input.subiektTwId != null && input.subiektTwId > 0
      ? Math.trunc(input.subiektTwId)
      : null;
  if (twId == null || !input.teethTwIdSet.has(twId)) return;
  const info = input.teethInfoByTwId?.get(twId);
  const teethDetails = normalizeTeethDetailsForSave(input.teethDetails, info?.kind ?? null);
  assertTeethLineDetailsComplete(
    {
      teethDetails,
      quantity: input.quantity ?? "",
      product: input.product,
      subiektTwId: twId,
      adminProductLine: info?.productLine ?? null,
      adminManufacturer: info?.manufacturer ?? null,
      isTeethProduct: true,
    },
    input.label
  );
}
