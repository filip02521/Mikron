/** Harness UI: zawsze w `next dev`; na zbudowanej aplikacji tylko z E2E_LAB=1 (CI Playwright). */
export function isE2ELabEnabled(): boolean {
  return process.env.E2E_LAB === "1" || process.env.NODE_ENV === "development";
}
