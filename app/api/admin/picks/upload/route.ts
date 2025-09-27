import { NextResponse } from "next/server";
import type { ContestId } from "@/lib/contest-store";
import {
  ingestContestWeekPicks,
  type WeekPickIngestResult,
} from "@/lib/contest-store";
import { WeekKey } from "@/lib/survivor";
import { requireBasicAuth } from "@/lib/vercel-auth";

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

const VALID_IDS: ContestId[] = ["circa", "scs"];

function isContestId(value: string): value is ContestId {
  return (VALID_IDS as string[]).includes(value);
}

function normalizeWeekParam(value: FormDataEntryValue | null): WeekKey | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const upper = trimmed.toUpperCase();
  if (upper === "TG" || upper === "XMAS") return upper as WeekKey;
  const digits = upper.match(/\d+/);
  return digits ? (digits[0] as WeekKey) : undefined;
}

export async function POST(request: Request) {
  const authResponse = requireBasicAuth(request);
  if (authResponse) return authResponse;

  let form: FormData;
  try {
    form = await request.formData();
  } catch (error: any) {
    return NextResponse.json(
      { error: "invalid_form_data", detail: String(error?.message ?? error) },
      { status: 400 },
    );
  }

  const contestRaw = form.get("contestId");
  const contestId = typeof contestRaw === "string" && contestRaw.trim() ? contestRaw.trim() : "circa";
  if (!isContestId(contestId)) {
    return NextResponse.json({ error: "invalid_contest" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  const weekParam = normalizeWeekParam(form.get("week"));
  const sourceNameFromForm = typeof form.get("sourceName") === "string" ? (form.get("sourceName") as string).trim() : "";
  const sourceName = sourceNameFromForm || file.name || undefined;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch (error: any) {
    return NextResponse.json(
      { error: "file_read_failed", detail: String(error?.message ?? error) },
      { status: 400 },
    );
  }

  try {
    const result: WeekPickIngestResult = await ingestContestWeekPicks({
      contestId,
      content: buffer,
      week: weekParam,
      sourceName,
      filename: file.name,
      mimetype: file.type,
    });
    return NextResponse.json({ result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "ingest_failed", detail: String(error?.message ?? error) },
      { status: 500 },
    );
  }
}
