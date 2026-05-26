/** Ścieżki względem SUBIEKT_API_BASE_URL (np. http://192.168.0.140:5080/api/v1). */

export const SUBIEKT_PATHS = {
  health: "/health",
  examples: "/examples",
  docs: "/docs",
  products: "/products",
  product: (id: number | string) => `/products/${id}`,
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
} as const;
