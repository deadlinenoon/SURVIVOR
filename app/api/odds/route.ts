import { NextResponse } from "next/server";

const BOOKMAKER = "draftkings";

function withinRange(commenceISO: string, startISO?: string, endISO?: string) {
  if (!startISO || !endISO) return true; // no filter if not provided
  const t = +new Date(commenceISO);
  return t >= +new Date(startISO) && t <= +new Date(endISO);
}

export async function GET() {
  try {
    const key = process.env.ODDS_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "Missing ODDS_API_KEY" }, { status: 500 });
    }

    const startIso = process.env.WEEK_START_ISO || undefined;
    const endIso = process.env.WEEK_END_ISO || undefined;

    const url = new URL("https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds");
    url.searchParams.set("regions", "us");
    url.searchParams.set("markets", "h2h,spreads,totals");
    url.searchParams.set("oddsFormat", "american");
    url.searchParams.set("bookmakers", BOOKMAKER);
    url.searchParams.set("apiKey", key);

    const r = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!r.ok) {
      return NextResponse.json({ error: "odds_fetch_failed", detail: await r.text() }, { status: 502 });
    }
    const games = (await r.json()) as any[];

    const rows = games
      .filter((g) => withinRange(g.commence_time, startIso, endIso))
      .map((g) => {
        const bk = (g.bookmakers || []).find((b: any) => b.key === BOOKMAKER);
        const markets = Object.fromEntries((bk?.markets ?? []).map((m: any) => [m.key, m]));
        const h2h = markets["h2h"];
        const spr = markets["spreads"];
        const tot = markets["totals"];

        const moneyline: Record<string, number | undefined> = {};
        h2h?.outcomes?.forEach((o: any) => (moneyline[o.name] = o.price));

        let fav, dog;
        if (spr?.outcomes?.length === 2) {
          const [a, b] = spr.outcomes;
          const sorted = [a, b].sort((x: any, y: any) => (x.point ?? 0) - (y.point ?? 0)); // negative = favorite
          fav = { name: sorted[0].name, point: sorted[0].point, price: sorted[0].price };
          dog = { name: sorted[1].name, point: sorted[1].point, price: sorted[1].price };
        }

        let totals;
        if (tot?.outcomes?.length === 2) {
          const over = tot.outcomes.find((o: any) => /over/i.test(o.name))?.point;
          const under = tot.outcomes.find((o: any) => /under/i.test(o.name))?.point;
          totals = { over, under, line: over ?? under };
        }

        return {
          id: g.id,
          commence: g.commence_time,
          homeTeam: g.home_team,
          awayTeam: g.away_team,
          moneyline,
          spread: { fav, dog },
          totals,
        };
      });

    return NextResponse.json({ bookmaker: BOOKMAKER, rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "unexpected", detail: String(e?.message || e) }, { status: 500 });
  }
}
