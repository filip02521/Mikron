/**
 * @name Server action without authentication
 * @description Every exported async function starting with "action" must call
 *              an authentication function from @/lib/auth. This catches
 *              accidentally exposed server actions that skip auth checks.
 * @kind problem
 * @id js/mikron/server-action-missing-auth
 * @problem.severity error
 * @tags security
 * @external help https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
 */

import javascript

/**
 * Funkcje autentykacyjne używane w projekcie Mikron.
 * Każda server action musi wywołać przynajmniej jedną z nich.
 */
predicate isAuthFunction(string name) {
  name in [
    "getSessionUser",
    "getSessionUserForMutation",
    "requireAdmin",
    "requireAdminForMutation",
    "requireAdminOrSalesTeamManagement",
    "requireSalesAccount",
    "requireSalesAccountOrTeamManagement",
    "requireSalesTeamManagement",
    "requireOperations",
    "requireWarehouse",
    "requireTeethPanel",
    "requireReceiveMutateForOrders",
    "requireReceiveNotificationFlush",
    "requireSupplierManagement",
    "requireSubiektLookup"
  ]
}

/** Wywołanie funkcji autentykacyjnej w ciele funkcji. */
predicate isAuthCall(CallExpr call) {
  isAuthFunction(call.getCallee().getName())
}

/** Exported async function o nazwie zaczynającej się od "action". */
predicate isServerAction(Function f) {
  f.getName().matches("action%") and
  f.isAsync() and
  exists(f.getModifiers().any().toString() = "export")
}

from Function f
where
  isServerAction(f) and
  not exists(CallExpr c |
    c.getEnclosingFunction+() = f and
    isAuthCall(c)
  )
select f, "Server action '" + f.getName() + "' nie wywołuje żadnej funkcji autentykacyjnej (getSessionUser, requireAdmin, requireSalesAccount, itp.)."
