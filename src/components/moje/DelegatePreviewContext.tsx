"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";

const DelegatePreviewContext = createContext<string | null>(null);

export function DelegatePreviewProvider({
  delegateFor,
  children,
}: {
  delegateFor: string | null;
  children: React.ReactNode;
}) {
  return (
    <DelegatePreviewContext.Provider value={delegateFor}>
      {children}
    </DelegatePreviewContext.Provider>
  );
}

export function useDelegateFor(): string | null {
  return useContext(DelegatePreviewContext);
}

/** Licznik aktywnych instancji DelegateModeBackground — zapobiega flash przy nawigacji między podglądami */
let activeInstances = 0;

/**
 * Tryb podglądu/zastępstwa — ustawia data-delegate-preview na body.
 * Wszystkie efekty wizualne (gradient, pasek, sidebar, header) są w CSS
 * jako pseudo-elementy body — dzięki temu fade-in i fade-out działają
 * płynnie przy nawigacji między stronami (komponent może się odmontować,
 * a CSS transition na body::before/::after przeżyje).
 */
export function DelegateModeBackground({
  active,
  label,
  children,
  className,
}: {
  active: boolean;
  label?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setApplied(active));
    return () => cancelAnimationFrame(t);
  }, [active]);

  // Fade-in: ustaw atrybut synchronicznie (przed paint) żeby uniknąć flasha
  useLayoutEffect(() => {
    if (active) {
      document.body.setAttribute("data-delegate-preview", "true");
    }
  }, [active]);

  // Fade-out: usuń atrybut po paint żeby CSS transition zadziałało
  useEffect(() => {
    if (!active) {
      document.body.removeAttribute("data-delegate-preview");
    }
  }, [active]);

  // Cleanup na unmount — odłóż usunięcie atrybutu o klatkę,
  // żeby CSS transition zdążyła wystartować (fade-out).
  // Jeśli nowa instancja zamontuje się w tej klatce (nawigacja między podglądami),
  // licznik zapobiegnie usunięciu.
  useEffect(() => {
    activeInstances++;
    return () => {
      activeInstances--;
      if (activeInstances === 0) {
        requestAnimationFrame(() => {
          // Ponownie sprawdź — nowa instancja mogła się zamontować w międzyczasie
          if (activeInstances === 0) {
            document.body.removeAttribute("data-delegate-preview");
          }
        });
      }
    };
  }, []);

  return (
    <>
      {/* Pływający badge z imieniem — prawy górny róg */}
      <div
        className="delegate-preview-badge"
        style={{
          opacity: applied && label ? 1 : 0,
          transition: "opacity 1.2s ease-in-out 0.3s",
        }}
        role="status"
        aria-live="polite"
      >
        <span className="delegate-preview-badge-dot" aria-hidden />
        {label ? `Podgląd: ${label}` : "Podgląd"}
      </div>

      <div className={className}>
        {children}
      </div>
    </>
  );
}
