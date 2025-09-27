import { NextResponse } from "next/server";
import { listErrors, setErrorStatus } from "@/lib/system-store";
import { requireBasicAuth } from "@/lib/vercel-auth";

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

interface UpdatePayload {
  id?: string;
  status?: "open" | "investigating" | "resolved";
}

export async function GET(request: Request) {
  const authResponse = requireBasicAuth(request);
  if (authResponse) return authResponse;

  try {
    const errors = await listErrors();
    return NextResponse.json({ errors }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: "errors_load_failed", detail: String(error?.message ?? error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResponse = requireBasicAuth(request);
  if (authResponse) return authResponse;

  let payload: UpdatePayload;
  try {
    payload = (await request.json()) as UpdatePayload;
  } catch (error: any) {
    return NextResponse.json({ error: "invalid_json", detail: String(error?.message ?? error) }, { status: 400 });
  }

  if (!payload.id || !payload.status) {
    return NextResponse.json({ error: "missing_parameters" }, { status: 400 });
  }

  try {
    const errors = await setErrorStatus(payload.id, payload.status);
    return NextResponse.json({ errors }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: "error_update_failed", detail: String(error?.message ?? error) }, { status: 500 });
  }
}
