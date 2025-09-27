import { NextResponse } from "next/server";
import { isContestId, getContestView } from "@/lib/contest-api";

type ContestRouteParams = { id?: string | string[] };

export async function GET(
  _req: Request,
  context: { params?: Promise<ContestRouteParams> },
) {
  const rawParams = (await context.params) ?? {};
  const idValue = Array.isArray(rawParams.id) ? rawParams.id[0] : rawParams.id;
  const id = idValue ?? undefined;

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
