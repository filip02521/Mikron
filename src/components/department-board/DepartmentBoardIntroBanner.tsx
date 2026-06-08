"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";
import { DEPARTMENT_BOARD_INTRO_STORAGE_KEY } from "@/lib/department-board/onboarding-storage";

export function DepartmentBoardIntroBanner() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(DEPARTMENT_BOARD_INTRO_STORAGE_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden) return null;

  function dismiss() {
    try {
      localStorage.setItem(DEPARTMENT_BOARD_INTRO_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  }

  return (
    <div
      className={cn(
        "border-b border-indigo-100 bg-indigo-50/50 px-3 py-3 sm:px-4",
        salesChromeInsetClass
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2 text-xs leading-relaxed text-slate-700">
          <p className={cn(salesTypography.blockTitle, "text-indigo-950")}>
            Czym różni się ta strona od „Nowa prośba”?
          </p>
          <ul className="list-inside list-disc space-y-1 pl-0.5">
            <li>
              <strong className="font-semibold text-slate-900">Nowa prośba</strong> — składasz
              zamówienie lub prośbę o dostępność towaru (status w{" "}
              <Link href="/moje" className="font-medium text-indigo-700 hover:underline">
                Moje zamówienia
              </Link>
              ).
            </li>
            <li>
              <strong className="font-semibold text-slate-900">Ogłoszenia</strong> — komunikat od
              zakupów tylko do odczytu.
            </li>
            <li>
              <strong className="font-semibold text-slate-900">Pytania zespołu</strong> — pytanie
              ogólne; odpowiedź widzi cały dział (nie dotyczy konkretnej prośby).
            </li>
          </ul>
        </div>
        <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={dismiss}>
          Rozumiem
        </Button>
      </div>
    </div>
  );
}
