"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Jednorazowe przekierowania po zmianie tras (stare hashe / zakładki). */
export function LegacyProcurementRouteRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (pathname === "/kolejka" && hash === "#kolejka-zeby") {
      router.replace("/zeby/przyjecie");
    }
  }, [pathname, router]);

  return null;
}
