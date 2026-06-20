export const ZESPOL_MIGRATION_HINT =
  "Sprawdź migrację 028_sales_groups.sql w Supabase (grupy handlowców).";

export type ZespolLoadContext = "team" | "people" | "groups";

const LOAD_LABEL: Record<ZespolLoadContext, string> = {
  team: "Nie udało się wczytać zespołu.",
  people: "Nie udało się wczytać listy handlowców.",
  groups: "Nie udało się wczytać grup zespołu.",
};

/** Jednolity fallback przy błędzie wczytywania sekcji /zespol. */
export function zespolLoadErrorMessage(e: unknown, context: ZespolLoadContext): string {
  if (e instanceof Error && e.message.trim()) return e.message;
  return `${LOAD_LABEL[context]} ${ZESPOL_MIGRATION_HINT}`;
}
