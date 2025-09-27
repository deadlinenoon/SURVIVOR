import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BASIC_USER = process.env.ADMIN_USER || "thinmints";
const BASIC_PASS = process.env.ADMIN_PASS || "watson";

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();

  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
    });
  }

  const base64 = auth.split(" ")[1] ?? "";
  let decoded = "";
  try {
    decoded = base64 ? globalThis.atob(base64) : "";
  } catch (error) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
    });
  }

  const [user, pass] = decoded.split(":");

  if (user === BASIC_USER && pass === BASIC_PASS) return NextResponse.next();

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
  });
}

// Only run on real pages. Exclude API, static, and Next internals.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|ico|json|txt|webp|avif|gif|css|js)).*)",
  ],
};
