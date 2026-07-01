"use client";

import { ensureCryptoRandomUUID } from "@/lib/ensure-crypto";

ensureCryptoRandomUUID();

/** Wczesny polyfill crypto.randomUUID (LAN / HTTP) — bez <script> w drzewie React 19. */
export function CryptoPolyfillInit() {
  return null;
}
