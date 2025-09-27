import { NextRequest, NextResponse } from "next/server";
import { isContestId, getContestView } from "@/lib/contest-api";

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  if (typeof id !== "string" || !isContestId(id)) {
    return NextResponse.json({ error: "contest_not_found" }, { status: 404 });
  }

  try {
    const view = await getContestView(id);
    return NextResponse.json(view);
  } catch (error: any) {
    return NextResponse.json({ error: "contest_load_failed", detail: String(error?.message ?? error) }, { status: 500 });
  }
}
