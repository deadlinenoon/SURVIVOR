export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return new Response(JSON.stringify({ ok: true, ts: Date.now() }), { status: 200 });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: String(error?.message ?? error) }),
      { status: 500 },
    );
  }
}
