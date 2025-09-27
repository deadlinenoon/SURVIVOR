import { NextResponse } from "next/server";

const DEFAULT_USER = process.env.ADMIN_USER || "thinmints";
const DEFAULT_PASS = process.env.ADMIN_PASS || "watson";

export function validateBasicAuth(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;

  try {
    const decoded = Buffer.from(header.split(" ")[1] ?? "", "base64").toString("utf8");
    const [user, pass] = decoded.split(":");
    return user === DEFAULT_USER && pass === DEFAULT_PASS;
  } catch {
    return false;
  }
}

export function requireBasicAuth(request: Request) {
  if (validateBasicAuth(request)) return null;
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
  });
}
