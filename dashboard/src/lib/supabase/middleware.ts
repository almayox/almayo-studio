import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function allowedEmailsFromEnv() {
  return (process.env.ADMIN_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function isAllowedAdmin(
  supabase: ReturnType<typeof createServerClient>,
  email: string,
) {
  const envList = allowedEmailsFromEnv();
  if (envList.length > 0) {
    return envList.includes(email.toLowerCase());
  }

  const { count } = await supabase
    .from("admin_allowlist")
    .select("*", { count: "exact", head: true });
  if (!count) return true;

  const { data } = await supabase
    .from("admin_allowlist")
    .select("email")
    .ilike("email", email)
    .maybeSingle();
  return Boolean(data);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLogin =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  if (!user && !isLogin) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && !isLogin) {
    const allowed = await isAllowedAdmin(supabase, user.email || "");
    if (!allowed) {
      await supabase.auth.signOut();
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(redirectUrl);
    }

    const isMfaRoute = pathname.startsWith("/login/mfa");
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (
      aal?.nextLevel === "aal2" &&
      aal.currentLevel !== "aal2" &&
      !isMfaRoute
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login/mfa";
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (
    user &&
    (pathname.startsWith("/login") || pathname.startsWith("/forgot-password")) &&
    !pathname.startsWith("/login/mfa")
  ) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const redirectUrl = request.nextUrl.clone();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      redirectUrl.pathname = "/login/mfa";
    } else {
      redirectUrl.pathname = "/projects";
    }
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
