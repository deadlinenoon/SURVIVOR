import { NextResponse } from "next/server";
import {
  ContestId,
  getContestView,
  getPersistedUpdatedAt,
  upsertContestPick,
} from "@/lib/contest-store";
import { Result } from "@/lib/survivor";
import { requireBasicAuth } from "@/lib/vercel-auth";

const VALID_IDS: ContestId[] = ["circa", "scs"];

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

function isContestId(value: string): value is ContestId {
  return (VALID_IDS as string[]).includes(value);
}

type UpsertBody = {
  contestId?: string;
  entryName?: string;
  week?: string;
  team?: string;
  result?: Result;
};

export async function POST(request: Request) {
  const authResponse = requireBasicAuth(request);
  if (authResponse) return authResponse;

  let payload: UpsertBody;
  try {
    payload = (await request.json()) as UpsertBody;
  } catch (error: any) {
    return NextResponse.json({ error: "invalid_json", detail: String(error?.message ?? error) }, { status: 400 });
  }

  const { contestId, entryName, week, team, result } = payload;
  if (!contestId || !isContestId(contestId)) {
    return NextResponse.json({ error: "invalid_contest" }, { status: 400 });
  }
  if (!entryName) {
    return NextResponse.json({ error: "missing_entry" }, { status: 400 });
  }
  if (!week) {
    return NextResponse.json({ error: "missing_week" }, { status: 400 });
  }
  if (!team) {
    return NextResponse.json({ error: "missing_team" }, { status: 400 });
  }

  try {
    await upsertContestPick({ contestId, entryName, week, team, result });
    const [view, updatedAt] = await Promise.all([
      getContestView(contestId),
      getPersistedUpdatedAt(contestId),
    ]);
    return NextResponse.json({ view, updatedAt }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: "update_failed", detail: String(error?.message ?? error) }, { status: 500 });
  }
}
