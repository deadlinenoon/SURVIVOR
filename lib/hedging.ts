export type ChicagoMode = "CHIRAQI" | "SOLDIER" | "OBLOCK" | "CCC";

export interface HedgeInputs {
  opponentMl: number | null;
  stake: number;
  winProbability: number; // 0–1
  equityIfWin: number;
  buyIn: number;
}

export interface HedgeOutcomes {
  decimalOdds: number;
  netWin: number;
  netLose: number;
  afterWin: number;
  afterLose: number;
  expectedValue: number;
  expectedAfter: number;
  floorBeforeBuy: number;
  floorAfterBuy: number;
  equalizedFloor: number | null;
}

export interface ChicagoInputs {
  mode: ChicagoMode;
  week: number;
  opponentMl: number;
  spreadPrice: number;
  entryFee: number;
  recouped: number;
}

export interface ChicagoRecommendation {
  stakeML: number;
  stakeSpread: number;
  dogWins: number;
  dogCovers: number;
  favWins: number;
  target: number;
}

export function americanToDecimal(input: number | string | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  const american = Number(input);
  if (!Number.isFinite(american) || american === 0) return null;
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}

export function payPerDollar(american: number | string | null | undefined): number {
  const decimal = americanToDecimal(american);
  if (!decimal || decimal <= 1) return 0;
  return decimal - 1;
}

export function impliedProbability(american: number | string | null | undefined): number {
  const decimal = americanToDecimal(american);
  if (!decimal) return 0;
  return 1 / decimal;
}

export function weeklyHedgeTarget(entryFee: number, rawWeek: number, recouped = 0): number {
  const E = Math.max(0, Number(entryFee) || 0);
  const w = Number(rawWeek);
  const R = Math.max(0, Number(recouped) || 0);
  if (!Number.isFinite(w)) return Math.max(0, E - R);

  if (w <= 11) {
    const need = Math.max(0, E - R);
    const weeksLeftToTG = Math.max(1, 12 - w);
    const amortized = need / weeksLeftToTG;
    const rampMin = 0.08 * E * Math.pow(1.15, Math.max(0, w - 1));
    return Math.max(amortized, rampMin);
  }
  if (w <= 14) {
    return Math.max(0.35 * E, 0.3 * E * Math.pow(1.25, w - 12));
  }
  return Math.max(0.6 * E, 0.45 * E * Math.pow(1.3, w - 15));
}

export function computeHedgeOutcomes(inputs: HedgeInputs): HedgeOutcomes {
  const decimalOdds = Math.max(1.01, americanToDecimal(inputs.opponentMl) ?? 2.2);
  const stake = Math.max(0, inputs.stake);
  const pWin = Math.min(0.99, Math.max(0.01, inputs.winProbability));
  const equity = Math.max(0, inputs.equityIfWin);
  const buyIn = Math.max(0, inputs.buyIn);

  const netWin = -stake;
  const netLose = stake * (decimalOdds - 1);
  const afterWin = equity - stake - buyIn;
  const afterLose = netLose - buyIn;
  const expectedValue = pWin * netWin + (1 - pWin) * netLose;
  const expectedAfter = pWin * afterWin + (1 - pWin) * afterLose;
  const floorBeforeBuy = Math.min(equity - stake, netLose);
  const floorAfterBuy = floorBeforeBuy - buyIn;
  const equalizedFloor = equity ? (equity * (decimalOdds - 1)) / decimalOdds : null;

  return {
    decimalOdds,
    netWin,
    netLose,
    afterWin,
    afterLose,
    expectedValue,
    expectedAfter,
    floorBeforeBuy,
    floorAfterBuy,
    equalizedFloor,
  };
}

export function equalizeStake(decimalOdds: number, equity: number): number {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return 0;
  return equity / decimalOdds;
}

export function floorStake(
  targetFloor: number,
  decimalOdds: number,
  equity: number,
): { feasible: boolean; stake: number; maxFloor: number } {
  const slope = decimalOdds - 1;
  if (slope <= 0) {
    return { feasible: false, stake: 0, maxFloor: 0 };
  }

  const maxFloor = equity ? (equity * slope) / decimalOdds : 0;
  if (targetFloor > maxFloor + 1e-6) {
    return { feasible: false, stake: 0, maxFloor };
  }

  const minStake = targetFloor / slope;
  const maxStake = Math.max(0, equity - targetFloor);
  const stake = Math.min(Math.max(minStake, 0), maxStake);
  return { feasible: true, stake, maxFloor };
}

export const CHICAGO_MODE_INFO: Record<ChicagoMode, string> = {
  CHIRAQI: "Full moneyline hedge — every dollar rides the opponent ML.",
  SOLDIER: "Even 50/50 split between opponent ML and spread to balance win-or-cover.",
  OBLOCK: "Seventy-five / twenty-five ML-heavy blend that tightens the downside.",
  CCC: "Twenty-five / seventy-five spread-weighted mix to bank when the dog covers.",
};

export function computeChicagoRecommendation(inputs: ChicagoInputs): ChicagoRecommendation {
  const { mode, week, opponentMl, spreadPrice, entryFee, recouped } = inputs;
  const target = weeklyHedgeTarget(entryFee, week, recouped);
  const pML = payPerDollar(opponentMl);
  const pSP = payPerDollar(spreadPrice);

  if (mode === "CHIRAQI" || pSP <= 0) {
    if (pML <= 0) {
      return {
        stakeML: 0,
        stakeSpread: 0,
        dogWins: 0,
        dogCovers: 0,
        favWins: 0,
        target,
      };
    }
    const stakeML = target / pML;
    return {
      stakeML,
      stakeSpread: 0,
      dogWins: target,
      dogCovers: -stakeML,
      favWins: -stakeML,
      target,
    };
  }

  if (mode === "SOLDIER") {
    if (pML <= 0 || pSP <= 0) {
      return {
        stakeML: 0,
        stakeSpread: 0,
        dogWins: 0,
        dogCovers: 0,
        favWins: 0,
        target,
      };
    }
    const stakeML = target / (1 + pML);
    const stakeSP = target / (pSP * (1 + pML));
    return {
      stakeML,
      stakeSpread: stakeSP,
      dogWins: target,
      dogCovers: stakeSP * pSP - stakeML,
      favWins: -(stakeML + stakeSP),
      target,
    };
  }

  if (pML <= 0 || pSP <= 0) {
    return {
      stakeML: 0,
      stakeSpread: 0,
      dogWins: 0,
      dogCovers: 0,
      favWins: 0,
      target,
    };
  }

  if (mode === "OBLOCK") {
    const ratio = 0.75;
    const totalStake = target / (ratio * pML + (1 - ratio) * pSP);
    const stakeML = ratio * totalStake;
    const stakeSP = (1 - ratio) * totalStake;
    return {
      stakeML,
      stakeSpread: stakeSP,
      dogWins: target,
      dogCovers: stakeSP * pSP - stakeML,
      favWins: -totalStake,
      target,
    };
  }

  // Capone Cover Collector — spread heavy 75/25
  const ratio = 0.75;
  const totalStake = target / ((1 - ratio) * pML + ratio * pSP);
  const stakeML = (1 - ratio) * totalStake;
  const stakeSP = ratio * totalStake;

  return {
    stakeML,
    stakeSpread: stakeSP,
    dogWins: target,
    dogCovers: stakeSP * pSP - stakeML,
    favWins: -totalStake,
    target,
  };
}

export function profitForAmerican(american: number | null, stake: number): number | null {
  if (american === null || !Number.isFinite(american)) return null;
  if (american > 0) return stake * (american / 100);
  if (american < 0) return stake * (100 / Math.abs(american));
  return null;
}
