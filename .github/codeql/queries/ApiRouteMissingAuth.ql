/**
 * @name API route handler without authentication
 * @description Every exported HTTP method handler (GET, POST, PUT, DELETE, PATCH)
 *              in a route.ts file must call an authentication function or
 *              authorizeCronRequest. This catches accidentally public API endpoints.
 * @kind problem
 * @id js/mikron/api-route-missing-auth
 * @problem.severity error
 * @tags security
 */

import javascript

bindingset[fnName]
predicate isAuthFunction(string fnName) {
  fnName in [
    "getSessionUser",
    "requireAdmin",
    "requireAdminForMutation",
    "requireSalesAccount",
    "requireOperations",
    "requireWarehouse",
    "requireTeethPanel",
    "requireSupplierManagement",
    "requireSubiektLookup",
    "authorizeCronRequest",
    "authorizeHealthRequest"
  ]
}

predicate isAuthCall(CallExpr call) {
  exists(VarRef v | v = call.getCallee() and isAuthFunction(v.getName()))
  or
  exists(PropAccess p | p = call.getCallee() and isAuthFunction(p.getPropertyName()))
}

/** Plik route.ts lub route.tsx w katalogu app/api. */
predicate isApiRouteFile(File f) {
  f.getBaseName() = "route.ts" or
  f.getBaseName() = "route.tsx"
}

/** Trasy celowo publiczne — logowanie, reset hasła, health/live.
 *  Te endpointy nie używają sesji bo użytkownik nie jest zalogowany. */
predicate isPublicRoute(File f) {
  f.getAbsolutePath().regexpMatch(".*/api/auth/login.*") or
  f.getAbsolutePath().regexpMatch(".*/api/auth/password-reset.*") or
  f.getAbsolutePath().regexpMatch(".*/api/health/live.*") or
  f.getAbsolutePath().regexpMatch(".*/auth/confirm.*")
}

/** Exported function z nazwą HTTP method. */
predicate isHttpHandler(Function f) {
  f.getName() in ["GET", "POST", "PUT", "DELETE", "PATCH"] and
  isApiRouteFile(f.getFile())
}

from Function f
where
  isHttpHandler(f) and
  not isPublicRoute(f.getFile()) and
  not exists(CallExpr c |
    c.getEnclosingFunction+() = f and
    isAuthCall(c)
  )
select f, "API route handler '" + f.getName() + "' w " + f.getFile().getBaseName() + " nie wywołuje żadnej funkcji autentykacyjnej."
