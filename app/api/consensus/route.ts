import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const week = process.env.WEEK_NUMBER ?? "4";
    const p = path.join(process.cwd(), "data", "consensus", `week-${week}.json`);
    const json = await fs.readFile(p, "utf8");
    const data = JSON.parse(json);
    return NextResponse.json({ week, data }, { status: 200 });
  } catch {
    // If file not present, hide the widget gracefully
    return NextResponse.json({ week: process.env.WEEK_NUMBER ?? "4", data: [] }, { status: 200 });
  }
}
