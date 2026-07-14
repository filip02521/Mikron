/**
 * @name Missing revalidatePath after mutation
 * @description Server actions that perform database mutations (insert, update,
 *              delete via Supabase) should call revalidatePath or revalidateTag
 *              to ensure cached pages are refreshed. Missing revalidation can
 *              cause stale data to persist after mutations.
 * @kind problem
 * @id js/mikron/missing-revalidate-after-mutation
 * @problem.severity warning
 * @tags correctness
 */

import javascript

predicate isServerAction(Function f) {
  f.getName().matches("action%") and
  f.isAsync() and
  exists(f.getModifiers().any().toString() = "export")
}

/** Wywołanie mutacji Supabase (.insert, .update, .delete, .upsert). */
predicate isMutationCall(CallExpr call) {
  call.getCallee().getName() in ["insert", "update", "delete", "upsert"]
}

/** Wywołanie revalidatePath lub revalidateTag. */
predicate isRevalidateCall(CallExpr call) {
  call.getCallee().getName() in ["revalidatePath", "revalidateTag"]
}

from Function f
where
  isServerAction(f) and
  exists(CallExpr c |
    c.getEnclosingFunction+() = f and
    isMutationCall(c)
  ) and
  not exists(CallExpr c |
    c.getEnclosingFunction+() = f and
    isRevalidateCall(c)
  )
select f, "Server action '" + f.getName() + "' wykonuje mutację bazy danych ale nie wywołuje revalidatePath/revalidateTag — dane mogą być nieaktualne."
