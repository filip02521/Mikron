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
  /** Kreator ilości do ZD (sprzedaż FS+PA + WZ niepowiązane + stany + otwarte ZK/ZD). */
  ordersZdEstimate: "/orders/zd/estimate",
  /** Otwarte ZK towaru (rozbicie rezerwacji / bez rezerwacji) — host ORDERS. */
  ordersZdEstimateZk: "/orders/zd/estimate/zk",
  /** Otwarte ZD towaru — host ORDERS. */
  ordersZdEstimateOtwarteZd: "/orders/zd/estimate/otwarteZd",
  /**
   * Komplety (montaż) — SELECT tw_Komplet.
   * Wymaga wdrożenia na hoście ORDERS; bez endpointu sync zwraca błąd.
   */
  productsKomplety: "/products/komplety",
  /**
   * Remanent na dzień (dok_MagRuch) — Inventory Ivoclar / stany historyczne.
   * Host ORDERS live `:5080` (zweryfikowane 2026-08).
   */
  productsRemanent: "/products/remanent",
  /** Słownik państw (`sl_Panstwo`) — ISO / kod UE. */
  kraje: "/kraje",
} as const;
