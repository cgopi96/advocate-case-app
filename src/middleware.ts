import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "./lib/session";

const PUBLIC_PATHS = ["/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC_PATHS.includes(pathname)) {
    if (session) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (!session) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // Sliding idle timeout: activity renews the session.
  const res = NextResponse.next();
  res.cookies.set(SESSION_COOKIE, await signSession(session), sessionCookieOptions);
  return res;
}

export const config = {
  // /api/cron is called by the scheduler and checks its own secret.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron/).*)"],
};
