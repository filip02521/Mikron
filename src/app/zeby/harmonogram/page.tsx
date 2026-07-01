import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Widok harmonogramu przeniesiony do kart dostawców (?tor=zeby). */
export default function ZebyHarmonogramRedirectPage() {
  redirect("/zakupy/dostawcy?tor=zeby");
}
