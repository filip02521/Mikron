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

predicate isAuthFunction(string name) {
  name in [
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
  isAuthFunction(call.getCallee().getName())
}

/** Plik route.ts lub route.tsx w katalogu app/api. */
predicate isApiRouteFile(File f) {
  f.getBaseName().matches("%route.ts") or
  f.getBaseName().matches("%route.tsx")
}

/** Exported function z nazwą HTTP method. */
predicate isHttpHandler(Function f) {
  f.getName() in ["GET", "POST", "PUT", "DELETE", "PATCH"] and
  isApiRouteFile(f.getFile())
}

from Function f
where
  isHttpHandler(f) and
  not exists(CallExpr c |
    c.getEnclosingFunction+() = f and
    isAuthCall(c)
  )
select f, "API route handler '" + f.getName() + "' w " + f.getFile().getBaseName() + " nie wywołuje żadnej funkcji autentykacyjnej."
