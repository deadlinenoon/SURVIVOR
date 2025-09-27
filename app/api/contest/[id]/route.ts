import { NextResponse } from "next/server";
import { isContestId, getContestView } from "@/lib/contest-api";

export async function GET(_req: Request, context: any) {
  const id = context?.params?.id;

  if (typeof id !== "string" || !isContestId(id)) {
    return NextResponse.json({ error: "contest_not_found" }, { status: 404 });
  }

  const view = await getContestView(id);
  return NextResponse.json(view);
}
