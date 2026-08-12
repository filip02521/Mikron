/** Ścieżki względem SUBIEKT_API_BASE_URL (np. http://192.168.0.140:5080/api/v1). */

export const SUBIEKT_PATHS = {
  health: "/health",
  examples: "/examples",
  docs: "/docs",
  products: "/products",
  product: (id: number | string) => `/products/${id}`,
  productsGroup: (id: number | string) => `/products/group/${id}`,
  groups: "/groups",
  /** Słownik cech towarów (`sl_CechaTw`) — host ORDERS (:5080/:5082). */
  cechyTowarow: "/cechy/towarow",
  kontrahenci: "/kontrahenci",
  kontrahent: (id: number | string) => `/kontrahenci/${id}`,
  dostawcy: "/kontrahenci/dostawcy",
  odbiorcy: "/kontrahenci/odbiorcy",
  documents: "/documents",
  document: (id: number | string) => `/documents/${id}`,
  documentsZk: "/documents/zk",
  documentZk: (id: number | string) => `/documents/zk/${id}`,
  documentsZd: "/documents/zd",
  documentZd: (id: number | string) => `/documents/zd/${id}`,
  /** Utworzenie ZD przez Sferę — host ORDERS (live :5080 lub test :5082). */
  documentsZdCreate: "/documents/zd/create",
  documentsFs: "/documents/fs",
  documentFs: (id: number | string) => `/documents/fs/${id}`,
  /** Kreator ilości do ZD (sprzedaż FS + stany + otwarte ZK/ZD). */
  ordersZdEstimate: "/orders/zd/estimate",
  /**
   * Komplety (montaż) — SELECT tw_Komplet.
   * Wymaga wdrożenia na hoście ORDERS; bez endpointu sync zwraca błąd.
   */
  productsKomplety: "/products/komplety",
} as const;
