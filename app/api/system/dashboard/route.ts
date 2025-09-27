import { NextResponse } from "next/server";
import { getDashboard } from "@/lib/system-store";

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDashboard();
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "dashboard_load_failed", detail: String(error?.message ?? error) },
      { status: 500 },
    );
  }
}
