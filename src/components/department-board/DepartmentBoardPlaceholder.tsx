import Link from "next/link";
import { surfaceCardClass, salesTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

export function DepartmentBoardPlaceholder({
  audience,
}: {
  audience: "sales" | "procurement";
}) {
  const isSales = audience === "sales";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 2xl:max-w-4xl">
      <header className="space-y-1">
        <h1 className={salesTypography.pageTitle}>Tablica — w przygotowaniu</h1>
        <p className={salesTypography.pageDesc}>
          {isSales
            ? "Tu zobaczysz ogłoszenia od działu zakupów i pytania całego zespołu handlowego."
            : "Tu opublikujesz ogłoszenia dla handlowców i odpowiesz na ich pytania."}
        </p>
      </header>

      <div className={cn(surfaceCardClass, "space-y-4 p-4 sm:p-5")}>
        <p className="text-sm leading-relaxed text-slate-700">
          Plan produktu:{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            docs/department-board-plan.md
          </code>
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded-md border border-indigo-100 bg-indigo-50/40 p-3">
            <h2 className="text-sm font-semibold text-indigo-950">Ogłoszenia</h2>
            <p className="mt-1 text-xs leading-relaxed text-indigo-900/80">
              {isSales
                ? "Wyróżnione komunikaty od zakupów — widoczne dla wszystkich handlowców."
                : "Jednokierunkowe informacje z możliwością przypięcia i daty wygaśnięcia."}
            </p>
          </section>
          <section className="rounded-md border border-slate-200 bg-slate-50/80 p-3">
            <h2 className="text-sm font-semibold text-slate-900">Pytania i odpowiedzi</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {isSales
                ? "Zadaj pytanie zakupom — odpowiedź zobaczy cały dział (bez powtarzania w mailach)."
                : "Lista pytań handlowców z odpowiedziami widocznymi dla wszystkich."}
            </p>
          </section>
        </div>

        {!isSales ? (
          <p className="text-xs text-slate-500">
            Wewnętrzne notatki działu (prywatne/wspólne) nadal są w{" "}
            <Link href="/notatki?dzial=zakupy" className="font-medium text-indigo-700 hover:underline">
              Notatki
            </Link>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}
