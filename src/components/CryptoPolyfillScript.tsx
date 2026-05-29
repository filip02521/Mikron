/** Kod wstrzykiwany w <head> przed hydracją (HTTP / brak secure context). */
export const CRYPTO_RANDOMUUID_POLYFILL = `
(function () {
  var c = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (!c || typeof c.randomUUID === "function") return;
  c.randomUUID = function () {
    if (typeof c.getRandomValues === "function") {
      var bytes = new Uint8Array(16);
      c.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      var hex = Array.prototype.map.call(bytes, function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
      return (
        hex.slice(0, 8) +
        "-" +
        hex.slice(8, 12) +
        "-" +
        hex.slice(12, 16) +
        "-" +
        hex.slice(16, 20) +
        "-" +
        hex.slice(20)
      );
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (ch) {
      var r = (Math.random() * 16) | 0;
      var v = ch === "x" ? r : (r & 3) | 8;
      return v.toString(16);
    });
  };
})();
`;

/**
 * Natywny <script> w layoutcie — bez next/script (React 19 nie wykonuje Script w drzewie klienta).
 */
export function CryptoPolyfillScript() {
  return (
    <script
      id="crypto-randomuuid-polyfill"
      dangerouslySetInnerHTML={{ __html: CRYPTO_RANDOMUUID_POLYFILL }}
    />
  );
}
