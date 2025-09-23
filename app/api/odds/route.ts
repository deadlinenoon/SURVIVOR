import { NextResponse } from "next/server";

// Single bookmaker to display (change if you want another)
const BOOKMAKER = "draftkings";

// Your TheOddsAPI key: keep it server-side only
const FALLBACK_KEY = "144d3e338306ea2e854a1feaf15fe8a0";

export async function GET() {
  try {
    const key = process.env.ODDS_API_KEY || FALLBACK_KEY;
    if (!key) {
      return NextResponse.json({ error: "Missing ODDS_API_KEY" }, { status: 500 });
    }

    const base = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds";
    const url = `${base}?regions=us&markets=h2h,spreads&oddsFormat=american&bookmakers=${BOOKMAKER}&apiKey=${encodeURIComponent(
      key
    )}`;

    const r = await fetch(url, { next: { revalidate: 60 } });
    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json({ error: "odds_fetch_failed", detail: text }, { status: 502 });
    }
    const games = (await r.json()) as any[];

    const rows = games.map((g) => {
      const bk = (g.bookmakers || []).find((b: any) => b.key === BOOKMAKER);
      const h2h = bk?.markets?.find((m: any) => m.key === "h2h");
      const spr = bk?.markets?.find((m: any) => m.key === "spreads");

      const h2hOutcomes: Record<string, number | undefined> = {};
      h2h?.outcomes?.forEach((o: any) => (h2hOutcomes[o.name] = o.price));

      let spreadFav: { name: string; point: number; price: number | undefined } | undefined;
      let spreadDog: { name: string; point: number; price: number | undefined } | undefined;
      if (spr?.outcomes?.length === 2) {
        const [a, b] = spr.outcomes;
        const fav = [a, b].sort((x: any, y: any) => (x.point ?? 0) - (y.point ?? 0))[0];
        const dog = fav === a ? b : a;
        spreadFav = { name: fav.name, point: fav.point, price: fav.price };
        spreadDog = { name: dog.name, point: dog.point, price: dog.price };
      }

      return {
        id: g.id,
        commence: g.commence_time,
        homeTeam: g.home_team,
        awayTeam: g.away_team,
        moneyline: {
          [g.home_team]: h2hOutcomes[g.home_team],
          [g.away_team]: h2hOutcomes[g.away_team],
        },
        spread: { fav: spreadFav, dog: spreadDog },
      };
    });

    return NextResponse.json({ bookmaker: BOOKMAKER, rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "unexpected", detail: String(e?.message || e) }, { status: 500 });
  }
}
