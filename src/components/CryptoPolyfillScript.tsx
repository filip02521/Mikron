import Script from "next/script";

const POLYFILL = `
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

/** Uruchamia się przed hydracją — potrzebne przy logowaniu po IP (HTTP, nie secure context). */
export function CryptoPolyfillScript() {
  return <Script id="crypto-randomuuid-polyfill" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: POLYFILL }} />;
}
