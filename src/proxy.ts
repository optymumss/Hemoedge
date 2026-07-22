import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { SURFACE_ROLES, type Surface } from "@/lib/auth/roles";

const GATED_SURFACES = Object.keys(SURFACE_ROLES) as Surface[];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, supabase, user } = await updateSession(request);

  const surface = GATED_SURFACES.find((prefix) => pathname.startsWith(prefix));
  if (!surface) return response;

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  if (!role || !SURFACE_ROLES[surface].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  // Forward what we just verified so layouts don't re-authenticate and
  // re-query the profile from scratch on every navigation — see
  // lib/auth/get-profile.ts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", user.id);
  requestHeaders.set("x-user-role", role);
  requestHeaders.set("x-user-email", profile.email ?? user.email ?? "");
  requestHeaders.set("x-user-full-name", profile.full_name ?? "");

  const forwardedResponse = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.getAll().forEach((cookie) => forwardedResponse.cookies.set(cookie));
  return forwardedResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
