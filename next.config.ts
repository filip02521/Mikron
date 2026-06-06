import type { NextConfig } from "next";

const lanDevHost = process.env.LAN_DEV_HOST?.trim();
const extraActionOrigins = (process.env.SERVER_ACTION_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const defaultLanOrigins = [
  "192.168.68.51",
  "192.168.10.173",
  "192.168.0.140",
  "ontime.mikran.pl",
  "127.0.0.1",
  "localhost",
];

const nextConfig: NextConfig = {
  /** Wymagane w dev przy wejściu z telefonu po IP (Next blokuje cross-origin). */
  allowedDevOrigins: [
    ...defaultLanOrigins,
    ...(lanDevHost && !defaultLanOrigins.includes(lanDevHost) ? [lanDevHost] : []),
    ...extraActionOrigins,
  ],
  experimental: {
    /** Logowanie z LAN (np. http://ontime.mikran.pl:3000) */
    serverActions: {
      allowedOrigins: [
        "localhost",
        "127.0.0.1",
        ...(lanDevHost ? [lanDevHost] : []),
        ...defaultLanOrigins,
        ...extraActionOrigins,
      ],
    },
  },
};

export default nextConfig;
