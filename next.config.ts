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
  serverExternalPackages: ["exceljs"],
  /** Wymagane w dev przy wejściu z telefonu po IP (Next blokuje cross-origin). */
  allowedDevOrigins: [
    ...defaultLanOrigins,
    ...(lanDevHost && !defaultLanOrigins.includes(lanDevHost) ? [lanDevHost] : []),
    ...extraActionOrigins,
  ],
  experimental: {
    optimizePackageImports: ["date-fns"],
    /** Logowanie z LAN (np. http://ontime.mikran.pl:3000) */
    serverActions: {
      allowedOrigins: [
        "localhost",
        "127.0.0.1",
        ...(lanDevHost ? [lanDevHost] : []),
        ...defaultLanOrigins,
        ...extraActionOrigins,
      ],
      /**
       * Pliki w Server Actions (zdjęcia Tablicy ≤3×5 MB, pliki zębów ≤10 MB).
       * Wcześniej 4 MB — jedno skompresowane zdjęcie potrafiło już odrzucić request.
       */
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
