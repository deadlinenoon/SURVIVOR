"use client";

import { useMemo, useState } from "react";
import {
  CHICAGO_MODE_INFO,
  ChicagoMode,
  computeChicagoRecommendation,
  computeHedgeOutcomes,
  equalizeStake,
  floorStake,
  profitForAmerican,
  weeklyHedgeTarget,
} from "@/lib/hedging";

const MODE_LABEL: Record<ChicagoMode, string> = {
  CHIRAQI: "Chiraqi Dome",
  SOLDIER: "Soldier Cover",
  OBLOCK: "O-Block Lock",
  CCC: "Capone Cover Collector",
};

type NoticeTone = "info" | "warn" | "error";

type NoticeState = {
  tone: NoticeTone;
  message: string;
} | null;

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return moneyFormatter.format(value);
}

function formatSigned(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const formatted = moneyFormatter.format(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export default function HedgingTab() {
  const [calc, setCalc] = useState({
    opponentMl: "-120",
    stake: 50,
    winProbability: 60,
    equityIfWin: 1105,
    buyIn: 1300,
    targetFloor: 150,
    desiredProfit: 200,
  });

  const [notice, setNotice] = useState<NoticeState>(null);

  const opponentMlValue = useMemo(() => {
    const trimmed = calc.opponentMl.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }, [calc.opponentMl]);

  const outcomes = useMemo(
    () =>
      computeHedgeOutcomes({
        opponentMl: opponentMlValue,
        stake: Number.isFinite(calc.stake) ? calc.stake : 0,
        winProbability: (Number.isFinite(calc.winProbability) ? calc.winProbability : 60) / 100,
        equityIfWin: Number.isFinite(calc.equityIfWin) ? calc.equityIfWin : 0,
        buyIn: Number.isFinite(calc.buyIn) ? calc.buyIn : 0,
      }),
    [calc.buyIn, calc.equityIfWin, calc.stake, calc.winProbability, opponentMlValue],
  );

  const payout = useMemo(
    () => profitForAmerican(opponentMlValue, calc.stake),
    [calc.stake, opponentMlValue],
  );

  const totalReturn = payout !== null ? payout + calc.stake : null;

  const summaryText = useMemo(() => {
    if (calc.stake <= 0) {
      return "Stake is $0 — no hedge in place yet.";
    }
    if (opponentMlValue === null) {
      return "Add an opponent moneyline to see exact payouts. We’ll keep calculations live as you type.";
    }
    const beforeBuy = outcomes.floorBeforeBuy;
    const afterBuy = outcomes.floorAfterBuy;
    const floorDescriptor = afterBuy >= 0 ? "after buy-in floor" : "after buy-in shortfall";
    return `Wager ${formatMoney(calc.stake)} at ${opponentMlValue > 0 ? "+" : ""}${opponentMlValue}. If your pick loses, the hedge pays ${formatMoney(totalReturn ?? 0)} (${formatSigned(payout ?? 0)} profit). If it wins you burn ${formatMoney(calc.stake)}. Floor before buy-in ${formatMoney(beforeBuy)} (${floorDescriptor} ${formatSigned(afterBuy)}).`;
  }, [calc.stake, opponentMlValue, outcomes.floorAfterBuy, outcomes.floorBeforeBuy, payout, totalReturn]);

  const handleNotice = (tone: NoticeTone, message: string) => {
    setNotice({ tone, message });
  };

  const updateCalc = <K extends keyof typeof calc>(key: K, value: string) => {
    setCalc((prev) => ({
      ...prev,
      [key]: key === "opponentMl" ? value : Number(value),
    }));
  };

  const handleEqualize = () => {
    const stake = equalizeStake(outcomes.decimalOdds, calc.equityIfWin);
    setCalc((prev) => ({ ...prev, stake: Number.isFinite(stake) ? Number(stake.toFixed(2)) : prev.stake }));
    if (Number.isFinite(outcomes.equalizedFloor ?? NaN)) {
      handleNotice(
        "info",
        `Equalize outcomes: stake ≈ ${formatMoney(stake)} locks about ${formatMoney(outcomes.equalizedFloor ?? 0)} before buy-in.`,
      );
    } else {
      handleNotice("warn", "Equalize requires equity and opponent odds. Add those inputs to auto-calc.");
    }
  };

  const applyFloorTarget = (target: number, label: string) => {
    const { feasible, stake, maxFloor } = floorStake(target, outcomes.decimalOdds, calc.equityIfWin);
    if (!feasible) {
      handleNotice(
        "warn",
        `${label} ${formatMoney(target)} not feasible. Maximum reachable floor ≈ ${formatMoney(maxFloor)}.`,
      );
      return;
    }
    setCalc((prev) => ({ ...prev, stake: Number(stake.toFixed(2)) }));
    handleNotice(
      "info",
      `${label} ${formatMoney(target)} locked with minimum stake ≈ ${formatMoney(stake)} (max floor ≈ ${formatMoney(maxFloor)}).`,
    );
  };

  const handleTargetFloor = () => {
    applyFloorTarget(Math.max(0, calc.targetFloor), "Target floor");
  };

  const handleLockBuyIn = () => {
    applyFloorTarget(Math.max(0, calc.buyIn), "Lock buy-in");
  };

  const handleLockProfit = () => {
    applyFloorTarget(Math.max(0, calc.buyIn + calc.desiredProfit), "Lock profit");
  };

  const [chicago, setChicago] = useState({
    mode: "CHIRAQI" as ChicagoMode,
    week: 4,
    opponentMl: -120,
    spreadPrice: -110,
    entryFee: 1300,
    recouped: 0,
  });

  const chicagoRecommendation = useMemo(
    () =>
      computeChicagoRecommendation({
        mode: chicago.mode,
        week: Number.isFinite(chicago.week) ? chicago.week : 0,
        opponentMl: chicago.opponentMl,
        spreadPrice: chicago.spreadPrice,
        entryFee: chicago.entryFee,
        recouped: chicago.recouped,
      }),
    [chicago],
  );

  const chicagoTarget = useMemo(
    () => weeklyHedgeTarget(chicago.entryFee, chicago.week, chicago.recouped),
    [chicago.entryFee, chicago.recouped, chicago.week],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Hedge Calculator</h2>
            <p className="text-sm text-slate-400">
              Size a hedge stake using opponent moneyline odds, your entry equity, and goals for guaranteed floors.
            </p>
          </div>
          <div className="text-xs uppercase tracking-widest text-slate-500">
            Opponent ML {opponentMlValue !== null ? `${opponentMlValue > 0 ? "+" : ""}${opponentMlValue}` : "—"}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="flex flex-col gap-1 text-slate-300">
                <span className="text-xs uppercase tracking-widest text-slate-500">Opp. ML (American)</span>
                <input
                  type="text"
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  value={calc.opponentMl}
                  onChange={(event) => updateCalc("opponentMl", event.target.value)}
                  placeholder="e.g. +150"
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                <span className="text-xs uppercase tracking-widest text-slate-500">Stake ($)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  value={calc.stake}
                  min={0}
                  onChange={(event) => updateCalc("stake", event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                <span className="text-xs uppercase tracking-widest text-slate-500">Win chance for your pick (%)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  min={1}
                  max={99}
                  value={calc.winProbability}
                  onChange={(event) => updateCalc("winProbability", event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                <span className="text-xs uppercase tracking-widest text-slate-500">Entry equity if win ($)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  min={0}
                  value={calc.equityIfWin}
                  onChange={(event) => updateCalc("equityIfWin", event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                <span className="text-xs uppercase tracking-widest text-slate-500">Buy-in ($)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  min={0}
                  value={calc.buyIn}
                  onChange={(event) => updateCalc("buyIn", event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                <span className="text-xs uppercase tracking-widest text-slate-500">Target floor ($)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  min={0}
                  value={calc.targetFloor}
                  onChange={(event) => updateCalc("targetFloor", event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                <span className="text-xs uppercase tracking-widest text-slate-500">Desired profit ($)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  min={0}
                  value={calc.desiredProfit}
                  onChange={(event) => updateCalc("desiredProfit", event.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={handleEqualize}
                className="rounded-full bg-indigo-500 px-4 py-2 font-semibold text-white shadow hover:bg-indigo-400"
              >
                Equalize Outcomes
              </button>
              <button
                type="button"
                onClick={handleTargetFloor}
                className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 font-semibold text-slate-200 hover:bg-slate-700"
              >
                Hit Target Floor
              </button>
              <button
                type="button"
                onClick={handleLockBuyIn}
                className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 font-semibold text-slate-200 hover:bg-slate-700"
              >
                Lock Buy-In
              </button>
              <button
                type="button"
                onClick={handleLockProfit}
                className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 font-semibold text-slate-200 hover:bg-slate-700"
              >
                Lock Profit
              </button>
            </div>

            {notice && (
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  notice.tone === "info"
                    ? "border border-indigo-500/40 bg-indigo-500/10 text-indigo-100"
                    : "border border-amber-500/40 bg-amber-500/10 text-amber-100"
                }`}
              >
                {notice.message}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
              {summaryText}
            </div>
            <div className="text-xs text-slate-500">
              Hedging trims upside for a guaranteed floor. Size it when the room is on your opponent or you want to stabilize equity.
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="py-2 text-left">Scenario</th>
                  <th className="py-2 text-right">Net From Hedge</th>
                  <th className="py-2 text-right">After Buy-In</th>
                  <th className="py-2 text-right">EV (Outcome)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-100">
                <tr>
                  <td className="py-2">Your pick wins</td>
                  <td className="py-2 text-right font-mono">{formatSigned(outcomes.netWin)}</td>
                  <td className={`py-2 text-right font-mono ${outcomes.afterWin >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {formatSigned(outcomes.afterWin)}
                  </td>
                  <td className={`py-2 text-right font-mono ${outcomes.afterWin * (calc.winProbability / 100) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {formatSigned(outcomes.afterWin * (calc.winProbability / 100))}
                  </td>
                </tr>
                <tr>
                  <td className="py-2">Your pick loses</td>
                  <td className="py-2 text-right font-mono">{formatSigned(outcomes.netLose)}</td>
                  <td className={`py-2 text-right font-mono ${outcomes.afterLose >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {formatSigned(outcomes.afterLose)}
                  </td>
                  <td className={`py-2 text-right font-mono ${(outcomes.afterLose * (1 - calc.winProbability / 100)) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {formatSigned(outcomes.afterLose * (1 - calc.winProbability / 100))}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-xs uppercase tracking-widest text-slate-500">Expected value</td>
                  <td className={`py-2 text-right font-mono ${outcomes.expectedValue >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {formatSigned(outcomes.expectedValue)}
                  </td>
                  <td className={`py-2 text-right font-mono ${outcomes.expectedAfter >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {formatSigned(outcomes.expectedAfter)}
                  </td>
                  <td className={`py-2 text-right font-mono ${outcomes.expectedAfter >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {formatSigned(outcomes.expectedAfter)}
                  </td>
                </tr>
                {Number.isFinite(outcomes.equalizedFloor ?? NaN) && (
                  <tr>
                    <td className="py-2 text-xs uppercase tracking-widest text-slate-500">Equalized floor ref</td>
                    <td></td>
                    <td className="py-2 text-right text-xs text-slate-400">
                      ≈ {formatMoney(outcomes.equalizedFloor ?? 0)}
                    </td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Chicago Specials</h2>
            <p className="text-sm text-slate-400">
              Quick presets to cover the worst-case using ML-only or split hedges. Target amount this week ≈ {formatMoney(chicagoTarget)}.
            </p>
          </div>
          <div className="text-xs uppercase tracking-widest text-slate-500">
            Opponent ML {Number.isFinite(chicago.opponentMl) ? `${chicago.opponentMl > 0 ? "+" : ""}${chicago.opponentMl}` : "—"}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <label className="flex flex-col gap-1 text-slate-300">
                <span className="text-xs uppercase tracking-widest text-slate-500">Mode</span>
                <select
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  value={chicago.mode}
                  onChange={(event) =>
                    setChicago((prev) => ({ ...prev, mode: event.target.value as ChicagoMode }))
                  }
                >
                  {Object.entries(MODE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                <span className="text-xs uppercase tracking-widest text-slate-500">Week</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  value={chicago.week}
                  onChange={(event) =>
                    setChicago((prev) => ({ ...prev, week: Number(event.target.value) }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                <span className="text-xs uppercase tracking-widest text-slate-500">Opp. ML (American)</span>
                <input
                  type="number"
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  value={chicago.opponentMl}
                  onChange={(event) =>
                    setChicago((prev) => ({ ...prev, opponentMl: Number(event.target.value) }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                <span className="text-xs uppercase tracking-widest text-slate-500">Spread price (American)</span>
                <input
                  type="number"
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  value={chicago.spreadPrice}
                  onChange={(event) =>
                    setChicago((prev) => ({ ...prev, spreadPrice: Number(event.target.value) }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                <span className="text-xs uppercase tracking-widest text-slate-500">Entry fee ($)</span>
                <input
                  type="number"
                  min={0}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  value={chicago.entryFee}
                  onChange={(event) =>
                    setChicago((prev) => ({ ...prev, entryFee: Number(event.target.value) }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                <span className="text-xs uppercase tracking-widest text-slate-500">Recouped so far ($)</span>
                <input
                  type="number"
                  min={0}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  value={chicago.recouped}
                  onChange={(event) =>
                    setChicago((prev) => ({ ...prev, recouped: Number(event.target.value) }))
                  }
                />
              </label>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
              <div className="font-semibold text-white">{MODE_LABEL[chicago.mode]}</div>
              <div className="text-xs text-slate-400">{CHICAGO_MODE_INFO[chicago.mode]}</div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-100">
            <div className="text-xs uppercase tracking-widest text-slate-500">Recommended stakes</div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="py-2">Stake ML</td>
                  <td className="py-2 text-right font-mono">{formatMoney(chicagoRecommendation.stakeML)}</td>
                </tr>
                <tr>
                  <td className="py-2">Stake spread</td>
                  <td className="py-2 text-right font-mono">{formatMoney(chicagoRecommendation.stakeSpread)}</td>
                </tr>
                <tr>
                  <td className="py-2">Dog wins</td>
                  <td className="py-2 text-right font-mono">{formatMoney(chicagoRecommendation.dogWins)}</td>
                </tr>
                <tr>
                  <td className="py-2">Dog covers</td>
                  <td className="py-2 text-right font-mono">{formatMoney(chicagoRecommendation.dogCovers)}</td>
                </tr>
                <tr>
                  <td className="py-2">Fav wins & covers</td>
                  <td className="py-2 text-right font-mono">{formatMoney(chicagoRecommendation.favWins)}</td>
                </tr>
              </tbody>
            </table>
            <div className="text-xs text-slate-500">
              Target amount this week ≈ {formatMoney(chicagoRecommendation.target)}. Adjust ML/spread prices if you secure better numbers.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
