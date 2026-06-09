import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";

export type RouteAuthCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

/** Klient Supabase dla Route Handlerów — zbiera ciasteczka sesji do podpięcia pod odpowiedź. */
export function createSupabaseRouteHandlerClient(request: NextRequest) {
  const cookiesToAttach: RouteAuthCookie[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value);
            cookiesToAttach.push(cookie);
          }
        },
      },
    }
  );

  return { supabase, cookiesToAttach };
}

export function attachRouteAuthCookies(
  response: NextResponse,
  cookies: RouteAuthCookie[]
): NextResponse {
  for (const { name, value, options } of cookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}
