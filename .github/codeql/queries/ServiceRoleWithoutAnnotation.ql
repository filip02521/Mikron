/**
 * @name Service role client without annotation
 * @description Files using createAdminClient() must contain a @service-role-ok
 *              comment annotation explaining why service role is needed.
 *              This enforces conscious review of privileged database access.
 * @kind problem
 * @id js/mikron/service-role-without-annotation
 * @problem.severity warning
 * @tags security
 */

import javascript

/** Plik zawiera wywołanie createAdminClient(). */
predicate usesServiceRole(File f) {
  exists(CallExpr c |
    c.getCallee().getName() = "createAdminClient" and
    c.getEnclosingFunction().getFile() = f
  )
}

/** Plik zawiera adnotację @service-role-ok. */
predicate hasAnnotation(File f) {
  f.regexpMatch("(?s).*@service-role-ok.*")
}

from File f
where
  usesServiceRole(f) and
  not hasAnnotation(f) and
  // Wyklucz pliki infrastruktury — nie są server actions
  not f.getPath().regexpMatch(".*lib/supabase/admin.*") and
  not f.getPath().regexpMatch(".*lib/auth/profile.*") and
  not f.getPath().regexpMatch(".*scripts/.*")
select f, "Plik używa createAdminClient() ale nie zawiera adnotacji @service-role-ok — dodaj komentarz z uzasadnieniem."
