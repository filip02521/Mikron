"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";
import { PROSBA_VS_BOARD_HINT_STORAGE_KEY } from "@/lib/department-board/onboarding-storage";

export function ProsbaVsBoardHint() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(PROSBA_VS_BOARD_HINT_STORAGE_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden) return null;

  function dismiss() {
    try {
      localStorage.setItem(PROSBA_VS_BOARD_HINT_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  }

  return (
    <div
      className={cn(
        "border-b border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs leading-relaxed text-slate-700 sm:px-4",
        salesChromeInsetClass
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p>
          To formularz <strong className="font-semibold text-slate-900">prośby o towar</strong> — trafia
          do procesu zamówień. Ogólne pytanie do działu zakupów (bez zamawiania) zadaj w{" "}
          <Link href="/tablica" className="font-medium text-indigo-700 hover:underline">
            Komunikacja
          </Link>
          .
        </p>
        <Button type="button" size="sm" variant="ghost" className="shrink-0 text-xs" onClick={dismiss}>
          Ukryj
        </Button>
      </div>
    </div>
  );
}
