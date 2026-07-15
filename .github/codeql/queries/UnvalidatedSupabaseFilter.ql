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

/** Wywołanie metody filtra Supabase query builder — method calls z 2 arg (column, value).
 *  .filter() i .match() mają inną strukturę argumentów — wykluczone. */
predicate isSupabaseFilterCall(CallExpr call) {
  exists(PropAccess p | p = call.getCallee() and p.getPropertyName() in ["eq", "in", "like", "ilike"])
}

/** Drugi argument to surowy parametr z input (PropAccess na zmiennej input/body/params).
 *  input.supplierId.trim() to MethodCallExpr, nie PropAccess — więc nie matchuje.
 *  Ograniczenie do znanych nazw zmiennych redukuje false positives (np. user.id nie matchuje).
 *  Dodatkowo ograniczone do plików w app/api/ i app/actions/ — library functions w src/lib/
 *  mają typed parametry już zwalidowane przez wywołującą server action. */
predicate isRawInput(Expr arg) {
  exists(PropAccess p, VarRef v |
    p = arg and
    v = p.getBase() and
    v.getName() in ["input", "body", "params", "query", "form"] and
    (p.getFile().getAbsolutePath().regexpMatch(".*/app/api/.*") or
     p.getFile().getAbsolutePath().regexpMatch(".*/app/actions/.*"))
  )
}

from CallExpr call, Expr filterValue
where
  isSupabaseFilterCall(call) and
  call.getArgument(1) = filterValue and
  isRawInput(filterValue)
select call, "Filtr Supabase używa surowego wejścia bez .trim() lub walidacji: " + filterValue.toString() + "."
