import { NextResponse } from "next/server";
import { updateAnalyticsSnapshot, AnalyticsSnapshot } from "@/lib/system-store";
import { requireBasicAuth } from "@/lib/vercel-auth";

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authResponse = requireBasicAuth(request);
  if (authResponse) return authResponse;

  let payload: AnalyticsSnapshot;
  try {
    payload = (await request.json()) as AnalyticsSnapshot;
  } catch (error: any) {
    return NextResponse.json({ error: "invalid_json", detail: String(error?.message ?? error) }, { status: 400 });
  }

  if (!Array.isArray(payload.metrics)) {
    return NextResponse.json({ error: "invalid_metrics" }, { status: 400 });
  }

  try {
    const snapshot = await updateAnalyticsSnapshot({
      updatedAt: payload.updatedAt || new Date().toISOString(),
      metrics: payload.metrics,
    });
    return NextResponse.json({ analytics: snapshot }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: "analytics_update_failed", detail: String(error?.message ?? error) }, { status: 500 });
  }
}
