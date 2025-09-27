import { NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/vercel-auth";
import {
  clearRootingOverride,
  getRootingOverride,
  setRootingOverride,
} from "@/lib/system-store";
import type { ConsensusApiResponse } from "@/lib/rooting";
import { isConsensusApiResponse } from "@/lib/rooting";

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

interface OverridePayload {
  expiresAt?: string;
  sourceName?: string;
  sourcePath?: string;
  data?: ConsensusApiResponse;
}

export async function GET(request: Request) {
  const authResponse = requireBasicAuth(request);
  if (authResponse) return authResponse;

  const override = await getRootingOverride();
  return NextResponse.json({ override }, { status: 200 });
}

export async function POST(request: Request) {
  const authResponse = requireBasicAuth(request);
  if (authResponse) return authResponse;

  let payload: OverridePayload;
  try {
    payload = (await request.json()) as OverridePayload;
  } catch (error: any) {
    return NextResponse.json({ error: "invalid_json", detail: String(error?.message ?? error) }, { status: 400 });
  }

  if (!payload.data || !isConsensusApiResponse(payload.data)) {
    return NextResponse.json({ error: "invalid_override_data" }, { status: 400 });
  }

  const expiresAt = payload.expiresAt || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const override = await setRootingOverride({
    data: payload.data,
    expiresAt,
    sourceName: payload.sourceName,
    sourcePath: payload.sourcePath,
  });

  return NextResponse.json({ override }, { status: 200 });
}

export async function DELETE(request: Request) {
  const authResponse = requireBasicAuth(request);
  if (authResponse) return authResponse;

  await clearRootingOverride();
  return NextResponse.json({ ok: true }, { status: 200 });
}
