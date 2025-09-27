import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { load } from "cheerio";
import type { ConsensusApiResponse, ConsensusGame, ConsensusSource, MarketKey } from "@/lib/rooting";
import { createEmptyConsensus } from "@/lib/rooting";
import { clearRootingOverride, getRootingOverride } from "@/lib/system-store";

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

const SCORESANDODDS_URL =
  process.env.CONSENSUS_SOURCE_URL?.trim() ||
  "https://www.scoresandodds.com/nfl/consensus-picks";

const VSIN_URL = "https://data.vsin.com/nfl/betting-splits/";

const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36";

const MARKET_CLASS_MATCH: Record<MarketKey, RegExp> = {
  moneyline: /consensus-table-moneyline/i,
  spread: /consensus-table-spread/i,
};

function clampPercent(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(-100, Math.min(100, value));
}

function parsePercent(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(-?\d{1,3}(?:\.\d+)?)/);
  return clampPercent(match ? Number(match[1]) : null);
}

function extractEventId(htmlSnippet: string | undefined): string | undefined {
  if (!htmlSnippet) return undefined;
  const match = htmlSnippet.match(/data-event=\"([^\"]+)\"/);
  return match ? match[1] : undefined;
}

function normalizeLabel(label: string, fallback: string): string {
  const trimmed = label.replace(/\s+/g, " ").trim();
  return trimmed.length ? trimmed : fallback;
}

function formatMatchup(home: string, away: string): string {
  return `${away} @ ${home}`;
}

async function fetchScoresAndOdds(): Promise<ConsensusSource | null> {
  try {
    const response = await fetch(SCORESANDODDS_URL, {
      headers: { "User-Agent": DEFAULT_UA },
      next: { revalidate: 60 * 10 },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = load(html);
    const markets: Record<MarketKey, ConsensusGame[]> = {
      moneyline: [],
      spread: [],
    };

    $(".trend-card.consensus").each((_, element) => {
      const card = $(element);
      const classAttr = card.attr("class") ?? "";

      let market: MarketKey | null = null;
      (Object.entries(MARKET_CLASS_MATCH) as Array<[MarketKey, RegExp]>).forEach(
        ([key, regex]) => {
          if (regex.test(classAttr)) {
            market = key;
          }
        },
      );

      if (!market) return;

      const header = card.find(".event-header");
      const homeName = header
        .find(".team-pennant.right .team-name span")
        .first()
        .text()
        .trim();
      const awayName = header
        .find(".team-pennant.left .team-name span")
        .first()
        .text()
        .trim();

      if (!homeName || !awayName) return;

      const matchup = formatMatchup(homeName, awayName);
      const startISO =
        header.find(".event-info [data-role='localtime']").attr("data-value") ??
        null;

      const chart = card.find(".trend-graph-chart");
      const eventId = extractEventId(chart.attr("data-content"));

      const labelNodes = card.find(".trend-graph-sides strong");
      const awayLabel = normalizeLabel(labelNodes.eq(0).text(), awayName);
      const homeLabel = normalizeLabel(labelNodes.eq(1).text(), homeName);

      const blocks = card.find(".trend-graph-percentage");
      const betsBlock = blocks.eq(0);
      const moneyBlock = blocks.eq(1);

      const awayBetPct = parsePercent(
        betsBlock.find(".percentage-a").first().text(),
      );
      const homeBetPct = parsePercent(
        betsBlock.find(".percentage-b").first().text(),
      );

      const awayMoneyPct = parsePercent(
        moneyBlock.find(".percentage-a").first().text(),
      );
      const homeMoneyPct = parsePercent(
        moneyBlock.find(".percentage-b").first().text(),
      );

      markets[market].push({
        eventId,
        market,
        matchup,
        startISO,
        teams: [
          {
            team: awayName,
            label: awayLabel,
            betPercent: awayBetPct,
            moneyPercent: awayMoneyPct,
          },
          {
            team: homeName,
            label: homeLabel,
            betPercent: homeBetPct,
            moneyPercent: homeMoneyPct,
          },
        ],
      });
    });

    const sortByStart = (a: ConsensusGame, b: ConsensusGame) => {
      if (!a.startISO && !b.startISO) return a.matchup.localeCompare(b.matchup);
      if (!a.startISO) return 1;
      if (!b.startISO) return -1;
      return new Date(a.startISO).getTime() - new Date(b.startISO).getTime();
    };

    (Object.keys(markets) as MarketKey[]).forEach((key) => {
      markets[key] = markets[key].sort(sortByStart);
    });

    return {
      source: SCORESANDODDS_URL,
      fetchedAt: new Date().toISOString(),
      markets,
    };
  } catch {
    return null;
  }
}

function extractPercentPair(htmlSegment: string | undefined): [number | null, number | null] {
  if (!htmlSegment) return [null, null];
  const fragments = htmlSegment.split(/<hr\s*\/?\s*>/i);
  const values: number[] = [];
  fragments.forEach((fragment) => {
    const text = load(fragment).text();
    const matches = text.match(/-?\d{1,3}(?:\.\d+)?%/g);
    matches?.forEach((match) => {
      const numeric = parsePercent(match);
      if (numeric !== null) values.push(numeric);
    });
  });
  return [values[0] ?? null, values[1] ?? null];
}

async function fetchVsin(): Promise<ConsensusSource | null> {
  try {
    const response = await fetch(VSIN_URL, {
      headers: { "User-Agent": DEFAULT_UA },
      next: { revalidate: 60 * 5 },
    });
    if (!response.ok) return null;

    const html = await response.text();
    const $ = load(html);

    const markets: Record<MarketKey, ConsensusGame[]> = {
      moneyline: [],
      spread: [],
    };

    $("table.freezetable tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length < 10) return;

      const teamLinks = cells
        .eq(0)
        .find("a")
        .map((__, anchor) => $(anchor).text().trim())
        .get()
        .filter(Boolean);

      if (teamLinks.length < 2) return;

      const [awayName, homeName] = teamLinks.slice(-2);

      const [spreadHandleAway, spreadHandleHome] = extractPercentPair(cells.eq(2).html() ?? undefined);
      const [spreadBetsAway, spreadBetsHome] = extractPercentPair(cells.eq(3).html() ?? undefined);
      const [moneyHandleAway, moneyHandleHome] = extractPercentPair(cells.eq(8).html() ?? undefined);
      const [moneyBetsAway, moneyBetsHome] = extractPercentPair(cells.eq(9).html() ?? undefined);

      const matchup = formatMatchup(homeName, awayName);

      markets.spread.push({
        market: "spread",
        matchup,
        startISO: null,
        teams: [
          {
            team: awayName,
            label: awayName,
            betPercent: spreadBetsAway,
            moneyPercent: spreadHandleAway,
          },
          {
            team: homeName,
            label: homeName,
            betPercent: spreadBetsHome,
            moneyPercent: spreadHandleHome,
          },
        ],
      });

      markets.moneyline.push({
        market: "moneyline",
        matchup,
        startISO: null,
        teams: [
          {
            team: awayName,
            label: awayName,
            betPercent: moneyBetsAway,
            moneyPercent: moneyHandleAway,
          },
          {
            team: homeName,
            label: homeName,
            betPercent: moneyBetsHome,
            moneyPercent: moneyHandleHome,
          },
        ],
      });
    });

    return {
      source: VSIN_URL,
      fetchedAt: new Date().toISOString(),
      markets,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "auto";
  const now = new Date();

  if (mode !== "live") {
    const override = await getRootingOverride();
    if (override) {
      const expiresAt = new Date(override.expiresAt);
      if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime()) {
        const response: ConsensusApiResponse = {
          ...override.data,
          meta: {
            mode: "override",
            expiresAt: override.expiresAt,
            sourceName: override.sourceName ?? override.sourcePath ?? null,
            uploadedAt: override.uploadedAt,
          },
        };
        return NextResponse.json(response, { status: 200 });
      }

      await clearRootingOverride();
    }
  }

  const [scoresAndOdds, vsin] = await Promise.all([fetchScoresAndOdds(), fetchVsin()]);

  if (!scoresAndOdds && !vsin) {
    return NextResponse.json(
      { error: "consensus_sources_unavailable" },
      { status: 502 },
    );
  }

  const payload: ConsensusApiResponse = createEmptyConsensus();
  payload.sources.scoresandodds = scoresAndOdds;
  payload.sources.vsin = vsin;
  payload.meta = { mode: "live" };

  return NextResponse.json(payload, { status: 200 });
}
