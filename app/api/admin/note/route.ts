import { NextResponse } from "next/server";
import { setPinnedNote } from "@/lib/system-store";
import { requireBasicAuth } from "@/lib/vercel-auth";

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

interface Body {
  message?: string;
  author?: string | null;
}

export async function POST(request: Request) {
  const authResponse = requireBasicAuth(request);
  if (authResponse) return authResponse;

  let payload: Body;
  try {
    payload = (await request.json()) as Body;
  } catch (error: any) {
    return NextResponse.json({ error: "invalid_json", detail: String(error?.message ?? error) }, { status: 400 });
  }

  if (!payload.message || !payload.message.trim()) {
    return NextResponse.json({ error: "missing_message" }, { status: 400 });
  }

  try {
    const note = await setPinnedNote({ message: payload.message, author: payload.author });
    return NextResponse.json({ note }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: "note_update_failed", detail: String(error?.message ?? error) }, { status: 500 });
  }
}
