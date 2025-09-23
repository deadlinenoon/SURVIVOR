import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BASIC_USER = process.env.ADMIN_USER || "thinmints";
const BASIC_PASS = process.env.ADMIN_PASS || "watson";

const decodeBase64 = (b64: string) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const ch of b64.replace(/[^A-Za-z0-9+/=]/g, "")) {
    const val = alphabet.indexOf(ch);
    if (val < 0 || val === 64) break;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  return out;
};

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
    decoded = base64 ? decodeBase64(base64) : "";
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

export const config = { matcher: ["/admin/:path*"] };
