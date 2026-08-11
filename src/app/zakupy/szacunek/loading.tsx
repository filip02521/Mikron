import { Spinner } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import { zdEstimatePageShellClass } from "@/lib/ui/ontime-theme";

/**
 * Loading RSC przy wejściu z panelu (resolve zakresu) — ten sam język UX
 * co ZdEstimateLaunchProgressPanel po hydracji (bez skoku „szkielet formularza”).
 */
export default function ZdEstimateLoading() {
  return (
    <div className={zdEstimatePageShellClass}>
      <PageHeader
        title="Szacunek ZD"
        description="Przygotowuję listę do zamówienia…"
      />
      <section
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Dobieram zakres Subiekta"
        className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card-elevated)]"
      >
        <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-start gap-3.5">
            <Spinner size="md" className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                Przygotowuję zamówienie ZD
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Dobieram grupę lub cechę Subiekta dla dostawcy…
              </p>
            </div>
          </div>
        </div>
        <ol className="space-y-0 px-5 py-4 sm:px-6">
          {[
            { n: 1, title: "Zakres Subiekta", hint: "Trwa dopasowanie…", active: true },
            { n: 2, title: "Towary i stany", hint: "Oczekuje…", active: false },
            { n: 3, title: "Sprzedaż i zapas", hint: "Oczekuje…", active: false },
            { n: 4, title: "Lista do ZD", hint: "Oczekuje…", active: false },
          ].map((step, i) => (
            <li
              key={step.n}
              className={cn(
                "flex gap-3 py-2.5",
                i < 3 && "border-b border-slate-100/90"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  step.active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"
                )}
              >
                {step.n}
              </span>
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.active ? "text-slate-900" : "text-slate-400"
                  )}
                >
                  {step.title}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">{step.hint}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">
          <p className="text-xs leading-relaxed text-slate-500">
            Po dopasowaniu zakresu przejdziesz od razu do wyliczania listy.
          </p>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-200/80">
            <div className="h-full w-1/4 rounded-full bg-slate-800/80 motion-safe:animate-pulse" />
          </div>
        </div>
      </section>
    </div>
  );
}
