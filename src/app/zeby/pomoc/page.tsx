import { redirect } from "next/navigation";

/** Pomoc przeniesiona do stopki panelu (popover) — stary link kieruje do kolejki. */
export default function ZebyPomocRedirect() {
  redirect("/zeby/kolejka");
}
