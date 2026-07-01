import { redirect } from "next/navigation";

/** Widok podglądu magazynu zastąpiony operacyjnym przyjęciem w /zeby/przyjecie. */
export default function ZebyStatusMagazynuRedirect() {
  redirect("/zeby/przyjecie");
}
