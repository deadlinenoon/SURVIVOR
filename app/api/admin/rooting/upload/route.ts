import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireBasicAuth } from "@/lib/vercel-auth";
import { parseRootingPdf, type ParsedManualResult } from "@/lib/rooting-pdf";
import { cloneConsensusGame } from "@/lib/rooting";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "rooting");

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authResponse = requireBasicAuth(request);
  if (authResponse) return authResponse;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "invalid_content_type" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = file.name.replace(/[^a-z0-9.-]+/gi, "-");
  const filename = `${timestamp}-${safeName}`;
  const targetPath = path.join(UPLOAD_DIR, filename);

  await fs.writeFile(targetPath, buffer);

  let text = "";
  let warnings: string[] = [];
  let markets: ParsedManualResult["markets"] = { moneyline: [], spread: [] };
  try {
    const parsed = await parseRootingPdf(buffer);
    text = parsed.text;
    warnings = parsed.warnings;
    markets = {
      moneyline: parsed.markets.moneyline.map((game) => cloneConsensusGame(game)),
      spread: parsed.markets.spread.map((game) => cloneConsensusGame(game)),
    };
  } catch (error: any) {
    warnings = [error?.message ?? "Unable to parse PDF. Manual entry required."];
  }

  return NextResponse.json(
    {
      sourceName: file.name,
      sourcePath: `/uploads/rooting/${filename}`,
      text,
      markets,
      warnings,
    },
    { status: 200 },
  );
}
