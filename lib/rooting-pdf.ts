// pdf-parse's top-level entry pulls in test fixtures; import the worker bundle directly.
import pdf from "pdf-parse/lib/pdf-parse.js";
import type { ConsensusGame, MarketKey } from "@/lib/rooting";
import { getTeamCode, getTeamName } from "@/lib/survivor";

type PercentPair = [number | null, number | null];

interface MarketPercents {
  bet: PercentPair | null;
  money: PercentPair | null;
}

interface GameAccumulator {
  away: string;
  home: string;
  startISO: string | null;
  markets: Record<MarketKey, MarketPercents>;
}

interface BlockParseResult {
  game: GameAccumulator | null;
  warnings: string[];
}

export interface ParsedManualResult {
  text: string;
  markets: Record<MarketKey, ConsensusGame[]>;
  warnings: string[];
}

const MARKET_KEYWORDS: Record<MarketKey, RegExp[]> = {
  spread: [/\bspread\b/i, /\bats\b/i],
  moneyline: [/\bmoneyline\b/i, /\bmoney line\b/i, /\bml\b/i],
};

const BET_KEYWORDS = [/\bbets?\b/i, /\bticket?s?\b/i];
const MONEY_KEYWORDS = [/\bhandle\b/i, /\bmoney\b/i];

const PERCENT_REGEX = /-?\d{1,3}(?:\.\d+)?%/g;

function clampPercent(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return null;
  if (Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function parsePercentPair(source: string): PercentPair | null {
  const matches = source.match(PERCENT_REGEX);
  if (!matches || matches.length < 2) return null;
  const [first, second] = matches;
  const away = clampPercent(Number(first.replace("%", "")));
  const home = clampPercent(Number(second.replace("%", "")));
  return [away, home];
}

function resolveTeamIdentifier(value: string): string | null {
  const cleaned = value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-zA-Z0-9\s@]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const code = getTeamCode(cleaned);
  if (code) return code;
  const upper = cleaned.toUpperCase();
  return getTeamCode(upper ?? "") ?? null;
}

function findTeamsFromBlock(block: string): { away: string; home: string } | null {
  const normalized = block.replace(/\s+/g, " ");
  const matchupMatch = normalized.match(/([A-Za-z0-9 .]+?)\s*(?:@|vs\.?|at)\s*([A-Za-z0-9 .]+)/i);
  if (matchupMatch) {
    const awayCandidate = resolveTeamIdentifier(matchupMatch[1]);
    const homeCandidate = resolveTeamIdentifier(matchupMatch[2]);
    if (awayCandidate && homeCandidate) {
      return { away: awayCandidate, home: homeCandidate };
    }
  }

  const tokens = block
    .replace(/[\u2013\u2014]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const foundCodes: string[] = [];
  let index = 0;
  while (index < tokens.length) {
    let matched = false;
    for (let span = 3; span >= 1; span -= 1) {
      if (index + span > tokens.length) continue;
      const candidate = tokens.slice(index, index + span).join(" ");
      const code = resolveTeamIdentifier(candidate);
      if (code && !foundCodes.includes(code)) {
        foundCodes.push(code);
        index += span;
        matched = true;
        break;
      }
    }
    if (!matched) {
      index += 1;
    }
    if (foundCodes.length >= 2) break;
  }

  if (foundCodes.length >= 2) {
    return { away: foundCodes[0], home: foundCodes[1] };
  }
  return null;
}

function detectMarket(line: string): MarketKey | null {
  for (const [market, patterns] of Object.entries(MARKET_KEYWORDS) as Array<[MarketKey, RegExp[]]>) {
    if (patterns.some((pattern) => pattern.test(line))) {
      return market;
    }
  }
  return null;
}

function detectMetric(line: string): keyof MarketPercents | null {
  if (BET_KEYWORDS.some((pattern) => pattern.test(line))) return "bet";
  if (MONEY_KEYWORDS.some((pattern) => pattern.test(line.replace(/moneyline/gi, "")))) return "money";
  return null;
}

function parseBlock(block: string): BlockParseResult {
  const warnings: string[] = [];
  const teams = findTeamsFromBlock(block);
  if (!teams) {
    return { game: null, warnings: ["Unable to locate two NFL teams in block"] };
  }

  const markets: Record<MarketKey, MarketPercents> = {
    moneyline: { bet: null, money: null },
    spread: { bet: null, money: null },
  };

  const lines = block
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  lines.forEach((line) => {
    const pair = parsePercentPair(line);
    if (!pair) return;
    const lower = line.toLowerCase();
    const market = detectMarket(lower);
    if (!market) return;
    const metric = detectMetric(lower);

    if (metric) {
      if (!markets[market][metric]) {
        markets[market][metric] = pair;
      }
      return;
    }

    if (!markets[market].bet) {
      markets[market].bet = pair;
    } else if (!markets[market].money) {
      markets[market].money = pair;
    }
  });

  (Object.entries(markets) as Array<[MarketKey, MarketPercents]>).forEach(([market, values]) => {
    if (!values.bet && !values.money) {
      warnings.push(`No ${market} percentages detected for ${teams.away} @ ${teams.home}`);
    }
  });

  return {
    game: {
      away: teams.away,
      home: teams.home,
      startISO: null,
      markets,
    },
    warnings,
  };
}

function createConsensusGames(acc: GameAccumulator): Record<MarketKey, ConsensusGame | null> {
  const matchupLabel = `${getTeamName(acc.away)} @ ${getTeamName(acc.home)}`;
  const baseTeams = [
    {
      team: acc.away,
      label: getTeamName(acc.away),
    },
    {
      team: acc.home,
      label: getTeamName(acc.home),
    },
  ] as const;

  return {
    moneyline: acc.markets.moneyline.bet || acc.markets.moneyline.money
      ? {
          market: "moneyline",
          matchup: matchupLabel,
          startISO: acc.startISO,
          teams: [
            {
              ...baseTeams[0],
              betPercent: acc.markets.moneyline.bet?.[0] ?? null,
              moneyPercent: acc.markets.moneyline.money?.[0] ?? null,
            },
            {
              ...baseTeams[1],
              betPercent: acc.markets.moneyline.bet?.[1] ?? null,
              moneyPercent: acc.markets.moneyline.money?.[1] ?? null,
            },
          ],
        }
      : null,
    spread: acc.markets.spread.bet || acc.markets.spread.money
      ? {
          market: "spread",
          matchup: matchupLabel,
          startISO: acc.startISO,
          teams: [
            {
              ...baseTeams[0],
              betPercent: acc.markets.spread.bet?.[0] ?? null,
              moneyPercent: acc.markets.spread.money?.[0] ?? null,
            },
            {
              ...baseTeams[1],
              betPercent: acc.markets.spread.bet?.[1] ?? null,
              moneyPercent: acc.markets.spread.money?.[1] ?? null,
            },
          ],
        }
      : null,
  };
}

function consolidateGames(blocks: string[]): { markets: Record<MarketKey, ConsensusGame[]>; warnings: string[] } {
  const lookup = new Map<string, GameAccumulator>();
  const warnings: string[] = [];

  blocks.forEach((block) => {
    const { game, warnings: blockWarnings } = parseBlock(block);
    warnings.push(...blockWarnings);
    if (!game) return;
    const key = `${game.away}_${game.home}`;
    if (!lookup.has(key)) {
      lookup.set(key, game);
      return;
    }
    const existing = lookup.get(key)!;
    (Object.keys(existing.markets) as MarketKey[]).forEach((market) => {
      const current = existing.markets[market];
      const incoming = game.markets[market];
      (Object.keys(current) as (keyof MarketPercents)[]).forEach((metric) => {
        if (!current[metric] && incoming[metric]) {
          current[metric] = incoming[metric];
        }
      });
    });
  });

  const markets: Record<MarketKey, ConsensusGame[]> = {
    moneyline: [],
    spread: [],
  };

  lookup.forEach((acc) => {
    const parsed = createConsensusGames(acc);
    (Object.entries(parsed) as Array<[MarketKey, ConsensusGame | null]>).forEach(([market, game]) => {
      if (game) {
        markets[market].push(game);
      }
    });
  });

  const sorter = (a: ConsensusGame, b: ConsensusGame) => a.matchup.localeCompare(b.matchup);
  markets.moneyline.sort(sorter);
  markets.spread.sort(sorter);

  return { markets, warnings };
}

export async function parseRootingPdf(buffer: Buffer): Promise<ParsedManualResult> {
  const parsed = await pdf(buffer);
  const text = parsed.text ?? "";
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const { markets, warnings } = consolidateGames(blocks);

  if (!markets.moneyline.length && !markets.spread.length) {
    warnings.push("No matchups detected in PDF");
  }

  return {
    text,
    markets,
    warnings,
  };
}
