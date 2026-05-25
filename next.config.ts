import type { NextConfig } from "next";

const lanDevHost = process.env.LAN_DEV_HOST?.trim();

const nextConfig: NextConfig = {
  /** Wymagane w dev przy wejściu z telefonu po IP (Next blokuje cross-origin). */
  allowedDevOrigins: [
    "192.168.68.51",
    "127.0.0.1",
    "localhost",
    ...(lanDevHost && !["192.168.68.51", "localhost", "127.0.0.1"].includes(lanDevHost)
      ? [lanDevHost]
      : []),
  ],
  experimental: {
    /** Logowanie z telefonu w LAN (np. http://192.168.68.51:3000) */
    serverActions: {
      allowedOrigins: [
        "localhost",
        "127.0.0.1",
        ...(lanDevHost ? [lanDevHost] : []),
        "192.168.68.51",
      ],
    },
  },
};

export default nextConfig;
