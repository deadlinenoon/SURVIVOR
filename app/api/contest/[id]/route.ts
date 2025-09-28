import { NextResponse } from "next/server";
import { isContestId, getContestView } from "@/lib/contest-api";

export async function GET(_req: Request, context: any) {
  // Next.js 15 returns params as a Promise; await it before destructuring
  const params = await context.params;
  const id = params?.id;

  if (typeof id !== "string" || !isContestId(id)) {
    return NextResponse.json({ error: "contest_not_found" }, { status: 404 });
  }

  try {
    const view = await getContestView(id);
    return NextResponse.json(view);
  } catch (err: any) {
    // Don't leak stack traces; return a 500 with a basic message
    return NextResponse.json(
      { error: "contest_load_failed", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
