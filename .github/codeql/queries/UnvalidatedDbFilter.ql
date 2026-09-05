/**
 * @name Unvalidated string input in database query filter
 * @description Detects query builder calls (.eq, .in, .like, .ilike)
 *              that use raw input parameters without .trim() or validation.
 * @kind problem
 * @id js/mikron/unvalidated-db-filter
 * @problem.severity warning
 * @tags security
 */

import javascript

predicate isDbFilterCall(CallExpr call) {
  exists(PropAccess p | p = call.getCallee() and p.getPropertyName() in ["eq", "in", "like", "ilike"])
}

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
  isDbFilterCall(call) and
  call.getArgument(1) = filterValue and
  isRawInput(filterValue)
select call, "Filtr bazy używa surowego wejścia bez .trim() lub walidacji: " + filterValue.toString() + "."
