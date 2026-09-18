import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) =>
              supabaseResponse.cookies.set(
                name,
                value,
                options
              )
          );
        },
      },
    }
  );

  const { data, error } =
    await supabase.auth.getClaims();

  const isLoggedIn =
    !error && Boolean(data?.claims?.sub);

  const pathname = request.nextUrl.pathname;

  const isLoginPage =
    pathname === "/login" ||
    pathname.startsWith("/login/");

  if (!isLoggedIn && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";

    const redirectResponse =
      NextResponse.redirect(url);

    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });

    return redirectResponse;
  }

  if (isLoggedIn && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";

    const redirectResponse =
      NextResponse.redirect(url);

    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });

    return redirectResponse;
  }

  return supabaseResponse;
}