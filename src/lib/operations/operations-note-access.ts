import type { OperationsNoteVisibility } from "@/types/database";

/** Prywatne: autor / admin. Wspólne (public): każdy z dostępem do działu. */
export function canMutateOperationsNote(params: {
  visibility: OperationsNoteVisibility;
  createdBy: string;
  userId: string;
  isAdmin: boolean;
}): boolean {
  if (params.isAdmin) return true;
  if (params.createdBy === params.userId) return true;
  return params.visibility === "public";
}
