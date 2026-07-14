/**
 * @name Unvalidated string input in Supabase query filter
 * @description Detects Supabase query builder calls (.eq, .in, .like, .ilike)
 *              that use raw input parameters without .trim() or validation.
 *              This catches potential injection or empty-filter bypass issues
 *              where unvalidated user input reaches database queries.
 * @kind problem
 * @id js/mikron/unvalidated-supabase-filter
 * @problem.severity warning
 * @tags security
 */

import javascript

/** Wywołanie metody filtra Supabase query builder. */
predicate isSupabaseFilterCall(CallExpr call) {
  call.getCallee().getName() in ["eq", "in", "like", "ilike", "match", "filter"]
}

/** Drugi argument to surowy parametr z input (bez .trim() / walidacji). */
predicate isRawInput(Expr arg) {
  // Parametr funkcji używany bezpośrednio — np. input.supplierId
  exists(PropAccess p | p = arg) and
  not arg.anyExpr().toString().matches("%.trim()%")
}

from CallExpr call, Expr filterValue
where
  isSupabaseFilterCall(call) and
  call.getArgument(1) = filterValue and
  isRawInput(filterValue)
select call, "Filtr Supabase używa surowego wejścia bez .trim() lub walidacji: " + filterValue.toString() + "."
