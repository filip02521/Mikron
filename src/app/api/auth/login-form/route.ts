import { NextRequest, NextResponse } from "next/server";

/** Bez JS form robi POST — przekieruj na GET bez przetwarzania danych logowania. */
export async function POST(request: NextRequest) {
  const url = new URL("/login", request.url);
  url.searchParams.set("reason", "js-required");
  return NextResponse.redirect(url, 303);
}
