import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ContestId, getContestView, getPersistedUpdatedAt } from "@/lib/contest-store";

const VALID_IDS: ContestId[] = ["circa", "scs"];

function isContestId(value: string): value is ContestId {
  return (VALID_IDS as string[]).includes(value);
}

export async function GET(_: NextRequest, context: any) {
  const { id } = context?.params ?? {};
  if (typeof id !== "string" || !isContestId(id)) {
    return NextResponse.json({ error: "contest_not_found" }, { status: 404 });
  }

  try {
    const [view, updatedAt] = await Promise.all([
      getContestView(id),
      getPersistedUpdatedAt(id),
    ]);
    return NextResponse.json({ view, updatedAt }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: "contest_load_failed", detail: String(error?.message ?? error) }, { status: 500 });
  }
}
