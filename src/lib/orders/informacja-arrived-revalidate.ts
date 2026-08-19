import { revalidatePath } from "next/cache";

/**
 * Te same ścieżki co revalidateAll() po ręcznym actionMarkInformacjaArrived —
 * cron / fast-path muszą odświeżyć nav, podsumowanie i /moje.
 */
export function revalidateAfterInformacjaArrived(): void {
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/dostawy");
  revalidatePath("/historia");
  revalidatePath("/moje");
  revalidatePath("/plan");
  revalidatePath("/prosba");
  revalidatePath("/weryfikacja");
  revalidatePath("/zeby");
  revalidatePath("/zeby/przyjecie");
  revalidatePath("/zeby/kolejka");
  revalidatePath("/zeby/historia");
  revalidatePath("/zeby/harmonogram");
  revalidatePath("/zeby/status-magazynu");
  revalidatePath("/lokalizacje/[location]", "page");
  revalidatePath("/admin");
  revalidatePath("/admin/handlowcy");
  revalidatePath("/admin/uzytkownicy");
  revalidatePath("/zespol", "page");
  revalidatePath("/zespol/handlowcy", "page");
  revalidatePath("/zespol/grupy", "page");
  revalidatePath("/zakupy/dostawcy");
}
