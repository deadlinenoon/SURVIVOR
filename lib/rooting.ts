export type MarketKey = "moneyline" | "spread";

export interface ConsensusTeam {
  team: string;
  label?: string;
  betPercent: number | null;
  moneyPercent: number | null;
}

export interface ConsensusGame {
  eventId?: string;
  market: MarketKey;
  matchup: string;
  startISO: string | null;
  teams: [ConsensusTeam, ConsensusTeam];
}

export interface ConsensusSource {
  source: string;
  fetchedAt: string;
  markets: Record<MarketKey, ConsensusGame[]>;
}

export interface ConsensusApiResponse {
  sources: {
    scoresandodds?: ConsensusSource | null;
    vsin?: ConsensusSource | null;
    manual?: ConsensusSource | null;
  };
  meta?: {
    mode: "live" | "override";
    expiresAt?: string | null;
    sourceName?: string | null;
    uploadedAt?: string | null;
  };
}

export function createEmptyConsensus(): ConsensusApiResponse {
  return {
    sources: {
      scoresandodds: null,
      vsin: null,
      manual: null,
    },
  };
}

export function normalizePercent(value: number | string | null | undefined): number | null {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric as number)) return null;
  return Math.max(-100, Math.min(100, Number(numeric)));
}

export function cloneConsensusSource(source: ConsensusSource): ConsensusSource {
  return {
    source: source.source,
    fetchedAt: source.fetchedAt,
    markets: {
      moneyline: source.markets.moneyline?.map((game) => cloneConsensusGame(game)) ?? [],
      spread: source.markets.spread?.map((game) => cloneConsensusGame(game)) ?? [],
    },
  };
}

export function cloneConsensusGame(game: ConsensusGame): ConsensusGame {
  return {
    eventId: game.eventId,
    market: game.market,
    matchup: game.matchup,
    startISO: game.startISO,
    teams: [
      { ...game.teams[0] },
      { ...game.teams[1] },
    ],
  };
}

export function isConsensusApiResponse(value: unknown): value is ConsensusApiResponse {
  if (!value || typeof value !== "object") return false;
  const obj = value as ConsensusApiResponse;
  if (!obj.sources || typeof obj.sources !== "object") return false;
  return true;
}
