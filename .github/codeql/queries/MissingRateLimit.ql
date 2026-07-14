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
  f.getBaseName().matches("%route.ts") or
  f.getBaseName().matches("%route.tsx")
}

predicate isHttpHandler(Function f) {
  f.getName() in ["GET", "POST", "PUT", "DELETE", "PATCH"] and
  isApiRouteFile(f.getFile())
}

predicate isSensitivePath(File f) {
  f.getPath().regexpMatch(".*/api/auth/.*") or
  f.getPath().regexpMatch(".*/api/teeth-vision.*")
}

predicate isRateLimitCall(CallExpr call) {
  call.getCallee().getName().matches("%RateLimit%") or
  call.getCallee().getName().matches("%rateLimit%") or
  call.getCallee().getName() = "consumeAuthRateLimit"
}

from Function f
where
  isHttpHandler(f) and
  isSensitivePath(f.getFile()) and
  not exists(CallExpr c |
    c.getEnclosingFunction+() = f and
    isRateLimitCall(c)
  )
select f, "API route '" + f.getName() + "' w " + f.getFile().getPath() + " obsługuje wrażliwą operację bez rate limitingu."
