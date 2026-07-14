/**
 * @name Rate limit check missing in auth-sensitive API route
 * @description API routes that handle authentication (login, password reset)
 *              or expensive operations (OCR, AI) should include rate limiting.
 *              This catches routes that forgot to add rate limit checks.
 * @kind problem
 * @id js/mikron/missing-rate-limit
 * @problem.severity warning
 * @tags security
 */

import javascript

predicate isApiRouteFile(File f) {
  f.getBaseName() = "route.ts" or
  f.getBaseName() = "route.tsx"
}

predicate isHttpHandler(Function f) {
  f.getName() in ["GET", "POST", "PUT", "DELETE", "PATCH"] and
  isApiRouteFile(f.getFile())
}

predicate isSensitivePath(File f) {
  f.getAbsolutePath().regexpMatch(".*/api/auth/.*") or
  f.getAbsolutePath().regexpMatch(".*/api/teeth-vision.*")
}

/** Trasy celowo bez rate limitu — login-form to tylko redirect. */
predicate isExcludedPath(File f) {
  f.getAbsolutePath().regexpMatch(".*/api/auth/login-form.*")
}

predicate isRateLimitCall(CallExpr call) {
  exists(VarRef v | v = call.getCallee() and v.getName().matches("%RateLimit%"))
}

from Function f
where
  isHttpHandler(f) and
  isSensitivePath(f.getFile()) and
  not isExcludedPath(f.getFile()) and
  not exists(CallExpr c |
    c.getEnclosingFunction+() = f and
    isRateLimitCall(c)
  )
select f, "API route '" + f.getName() + "' w " + f.getFile().getAbsolutePath() + " obsługuje wrażliwą operację bez rate limitingu."
