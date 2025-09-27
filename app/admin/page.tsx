"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { ContestId, WeekPickIngestResult } from "@/lib/contest-store";
import type { ContestView, WeekPickSummary } from "@/lib/survivor";
import { getTeamName, getTeamCode } from "@/lib/survivor";
import type {
  AnalyticsMetric,
  DashboardData,
  DeltaKey,
  ErrorEntry,
  PinnedNote,
} from "@/lib/system-store";
import type {
  ConsensusApiResponse,
  ConsensusGame,
  MarketKey,
} from "@/lib/rooting";
import { createEmptyConsensus, cloneConsensusGame } from "@/lib/rooting";

const CONTEST_LABELS: Record<ContestId, string> = {
  circa: "Circa Survivor",
  scs: "SuperContest Survivor",
};

const CONTEST_ORDER: ContestId[] = ["circa", "scs"];

const updatedFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

type SelectionMap = Record<ContestId, Record<string, string>>;
type SavingMap = Record<ContestId, string | null>;
type EntryAlert = {
  tone: "success" | "error";
  message: string;
};

type InlineAlert = {
  tone: "success" | "error";
  message: string;
};

const DELTA_KEYS: DeltaKey[] = ["dod", "wow", "mom", "qoq", "yoy"];
const DELTA_LABELS: Record<DeltaKey, string> = {
  dod: "DoD",
  wow: "WoW",
  mom: "MoM",
  qoq: "QoQ",
  yoy: "YoY",
};

const deltaPreview = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const errorTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

const MARKET_KEYS: MarketKey[] = ["moneyline", "spread"];
const MARKET_LABEL: Record<MarketKey, string> = {
  moneyline: "Moneyline",
  spread: "Spread",
};
const MIN_OVERRIDE_LEAD_MINUTES = 10;
const PERCENT_TOLERANCE = 1.5;

function nextTuesdayIso(): string {
  const now = new Date();
  const date = new Date(now);
  const day = date.getDay();
  const daysUntilTuesday = (9 - day) % 7 || 7; // at least 1 day ahead
  date.setDate(date.getDate() + daysUntilTuesday);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

type RootingDraft = {
  data: ConsensusApiResponse;
  expiresAt: string;
  sourceName?: string;
  sourcePath?: string;
  textPreview?: string | null;
};

type ManualSource = NonNullable<ConsensusApiResponse["sources"]["manual"]>;

type RootingUploadResponse = {
  sourceName?: string;
  sourcePath?: string;
  text?: string;
  markets?: Record<MarketKey, ConsensusGame[]>;
  warnings?: string[];
};

type PercentPair = [number | null, number | null];

function validatePercentPair(pair: PercentPair, label: string, errors: string[]): void {
  const [away, home] = pair;
  const hasAway = away !== null && away !== undefined;
  const hasHome = home !== null && home !== undefined;
  if (!hasAway && !hasHome) return;
  if (hasAway !== hasHome) {
    errors.push(`Enter both values for ${label}.`);
    return;
  }
  if (away! < 0 || away! > 100 || home! < 0 || home! > 100) {
    errors.push(`${label} must stay between 0% and 100%.`);
    return;
  }
  if (Math.abs(away! + home! - 100) > PERCENT_TOLERANCE) {
    const total = (away! + home!).toFixed(1).replace(/\.0$/, "");
    errors.push(`${label} should total 100% (currently ${total}%).`);
  }
}

function collectRootingValidationErrors(draft: RootingDraft | null): string[] {
  if (!draft) return ["Add manual rooting data before saving."];

  const issues: string[] = [];
  if (!draft.expiresAt) {
    issues.push("Set an override expiry time.");
  } else {
    const expiry = new Date(draft.expiresAt);
    if (Number.isNaN(expiry.getTime())) {
      issues.push("Override expiry must be a valid date/time.");
    } else if (expiry.getTime() < Date.now() + MIN_OVERRIDE_LEAD_MINUTES * 60 * 1000) {
      issues.push(`Override expiry must be at least ${MIN_OVERRIDE_LEAD_MINUTES} minutes ahead.`);
    }
  }

  const manual = draft.data.sources.manual;
  if (!manual) {
    issues.push("Manual rooting data missing.");
    return issues;
  }

  let hasGame = false;
  const invalidTeamMemo = new Set<string>();

  MARKET_KEYS.forEach((market) => {
    manual.markets[market].forEach((game, index) => {
      hasGame = true;
      const matchupLabel = game.matchup?.trim() ? game.matchup.trim() : `Matchup ${index + 1}`;
      game.teams.forEach((team, teamIdx) => {
        const cleaned = team.team?.trim() ?? "";
        const resolved = cleaned ? getTeamCode(cleaned) : undefined;
        const memoKey = `${market}-${teamIdx}-${cleaned}`;
        if (!resolved && cleaned && !invalidTeamMemo.has(memoKey)) {
          invalidTeamMemo.add(memoKey);
          issues.push(
            `Invalid ${teamIdx === 0 ? "away" : "home"} team code "${cleaned}" in ${MARKET_LABEL[market]} matchup "${matchupLabel}".`,
          );
        }
      });

      validatePercentPair(
        [game.teams[0].betPercent ?? null, game.teams[1].betPercent ?? null],
        `${MARKET_LABEL[market]} bets for ${matchupLabel}`,
        issues,
      );
      validatePercentPair(
        [game.teams[0].moneyPercent ?? null, game.teams[1].moneyPercent ?? null],
        `${MARKET_LABEL[market]} money for ${matchupLabel}`,
        issues,
      );
    });
  });

  if (!hasGame) {
    issues.push("Manual upload must include at least one matchup.");
  }

  return issues;
}

function countParsedMatchups(markets?: Record<MarketKey, ConsensusGame[]> | null): number {
  if (!markets) return 0;
  const keys = new Set<string>();
  MARKET_KEYS.forEach((market) => {
    markets[market]?.forEach((game) => {
      const away = getTeamCode(game.teams[0]?.team ?? "") ?? game.teams[0]?.team ?? "";
      const home = getTeamCode(game.teams[1]?.team ?? "") ?? game.teams[1]?.team ?? "";
      keys.add(`${away}-${home}`);
    });
  });
  return keys.size;
}

function formatValidationSummary(issues: string[]): string {
  if (!issues.length) return "";
  if (issues.length === 1) return issues[0];
  const remaining = issues.length - 1;
  return `${issues[0]} (${remaining} more issue${remaining === 1 ? "" : "s"} to fix.)`;
}

function createEmptyGame(market: MarketKey): ConsensusGame {
  return {
    market,
    matchup: "Team A @ Team B",
    startISO: null,
    teams: [
      {
        team: "",
        label: "",
        betPercent: null,
        moneyPercent: null,
      },
      {
        team: "",
        label: "",
        betPercent: null,
        moneyPercent: null,
      },
    ],
  };
}

function toLocalDateTimeInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => value.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function normalizeMetrics(metrics: AnalyticsMetric[]): AnalyticsMetric[] {
  return metrics.map((metric, index) => {
    const deltas = metric.deltas ?? ({} as AnalyticsMetric["deltas"]);
    return {
      id: metric.id || `metric-${index}-${Date.now()}`,
      label: metric.label ?? "",
      unit: metric.unit ?? "",
      value: Number(metric.value) || 0,
      deltas: {
        dod: Number(deltas.dod ?? 0),
        wow: Number(deltas.wow ?? 0),
        mom: Number(deltas.mom ?? 0),
        qoq: Number(deltas.qoq ?? 0),
        yoy: Number(deltas.yoy ?? 0),
      },
    };
  });
}

function describeUpdatedAt(stamp?: string | null): string {
  if (!stamp) return "—";
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return stamp;
  return `${updatedFormatter.format(date)} ET`;
}

type ContestSectionProps = {
  contestId: ContestId;
  view: ContestView;
  selections: Record<string, string>;
  onSelectionChange: (entryName: string, value: string) => void;
  onSave: (entryName: string) => void;
  savingEntry: string | null;
  alerts: Record<string, EntryAlert>;
  updatedAt?: string | null;
};

function ContestSection({
  contestId,
  view,
  selections,
  onSelectionChange,
  onSave,
  savingEntry,
  alerts,
  updatedAt,
}: ContestSectionProps) {
  const weekKey = view.config.currentWeek;
  const headerLabel = useMemo(() => CONTEST_LABELS[contestId], [contestId]);
  const updatedLabel = useMemo(() => describeUpdatedAt(updatedAt), [updatedAt]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-inner">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{headerLabel} — {view.currentWeekLabel}</h2>
          <p className="text-sm text-slate-400">
            Assign picks for the current contest week. Saved picks sync straight to the Survivor Control Hub.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>Updated {updatedLabel}</div>
          <div>{view.entries.filter((entry) => !entry.eliminated).length} of {view.entries.length} entries alive</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {view.entries.map((entry) => {
          const selection = selections[entry.name] ?? "";
          const currentPick = entry.used.find((pick) => pick.week === weekKey);
          const entryKey = `${contestId}:${entry.name}`;
          const alert = alerts[entryKey];
          const saving = savingEntry === entry.name;

          const availableOptions = [...entry.availableTeams];
          if (currentPick && !availableOptions.some((team) => team.code === currentPick.team)) {
            availableOptions.unshift({ code: currentPick.team, name: getTeamName(currentPick.team) });
          }

          const noOptions = availableOptions.length === 0;
          const disabled = entry.eliminated || noOptions;

          return (
            <div
              key={entry.name}
              className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 shadow-inner"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-white">{entry.name}</span>
                  <span
                    className={`text-xs font-semibold ${entry.eliminated ? "text-rose-300" : "text-emerald-300"}`}
                  >
                    {entry.eliminated ? "Eliminated" : "Active"}
                  </span>
                </div>
                {entry.eliminationReason && (
                  <div className="text-xs text-rose-300">{entry.eliminationReason}</div>
                )}
                <div className="text-xs text-slate-400">
                  Current pick: {currentPick ? `${getTeamName(currentPick.team)} (${currentPick.team})` : "—"}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-slate-400">
                  <span>Week {weekKey} pick</span>
                  <select
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition focus:border-indigo-400 focus:outline-none disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/40 disabled:text-slate-500"
                    value={selection}
                    onChange={(event) => onSelectionChange(entry.name, event.target.value)}
                    disabled={disabled}
                  >
                    <option value="">Select team</option>
                    {availableOptions.map((team) => (
                      <option key={team.code} value={team.code}>
                        {team.name} ({team.code})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => onSave(entry.name)}
                  disabled={disabled || !selection || saving}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-indigo-500/60 bg-indigo-500/20 px-4 text-sm font-semibold text-indigo-200 transition hover:border-indigo-400 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/30 disabled:text-slate-500"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>

              {alert && (
                <div
                  className={`text-xs ${alert.tone === "success" ? "text-emerald-300" : "text-rose-300"}`}
                >
                  {alert.message}
                </div>
              )}

              {disabled && !entry.eliminated && (
                <div className="text-xs text-amber-300">
                  No remaining teams available before this week — double-check previous picks.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function AdminPage() {
  const [views, setViews] = useState<Partial<Record<ContestId, ContestView>>>({});
  const [updatedAt, setUpdatedAt] = useState<Partial<Record<ContestId, string | null>>>({});
  const [selections, setSelections] = useState<SelectionMap>({ circa: {}, scs: {} });
  const [saving, setSaving] = useState<SavingMap>({ circa: null, scs: null });
  const [alerts, setAlerts] = useState<Record<string, EntryAlert | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [analyticsDraft, setAnalyticsDraft] = useState<AnalyticsMetric[]>([]);
  const [analyticsSaving, setAnalyticsSaving] = useState(false);
  const [analyticsAlert, setAnalyticsAlert] = useState<InlineAlert>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteAlert, setNoteAlert] = useState<InlineAlert>(null);
  const [errorsData, setErrorsData] = useState<ErrorEntry[]>([]);
  const [errorAlert, setErrorAlert] = useState<InlineAlert>(null);
  const [errorUpdatingId, setErrorUpdatingId] = useState<string | null>(null);
  const [rootingDraft, setRootingDraft] = useState<RootingDraft | null>(null);
  const [rootingAlert, setRootingAlert] = useState<InlineAlert>(null);
  const [rootingSaving, setRootingSaving] = useState(false);
  const [rootingUploading, setRootingUploading] = useState(false);
  const [rootingWarnings, setRootingWarnings] = useState<string[]>([]);
  const [picksSummary, setPicksSummary] = useState<WeekPickSummary | null>(null);
  const [picksResult, setPicksResult] = useState<WeekPickIngestResult | null>(null);
  const [picksAlert, setPicksAlert] = useState<InlineAlert>(null);
  const [picksUploading, setPicksUploading] = useState(false);

  const updateRootingDraft = useCallback((updater: (draft: RootingDraft) => RootingDraft) => {
    setRootingDraft((prev) => {
      const base: RootingDraft = prev
        ? {
            ...prev,
            data: {
              ...prev.data,
              sources: {
                ...prev.data.sources,
                manual: prev.data.sources.manual
                  ? {
                      ...prev.data.sources.manual,
                      markets: {
                        moneyline: prev.data.sources.manual.markets.moneyline.map((game) => cloneConsensusGame(game)),
                        spread: prev.data.sources.manual.markets.spread.map((game) => cloneConsensusGame(game)),
                      },
                    }
                  : {
                      source: "Manual Upload",
                      fetchedAt: new Date().toISOString(),
                      markets: {
                        moneyline: [],
                        spread: [],
                      },
                    },
              },
            },
          }
        : {
            data: {
              ...createEmptyConsensus(),
              sources: {
                scoresandodds: null,
                vsin: null,
                manual: {
                  source: "Manual Upload",
                  fetchedAt: new Date().toISOString(),
                  markets: {
                    moneyline: [],
                    spread: [],
                  },
                },
              },
            },
            expiresAt: nextTuesdayIso(),
            textPreview: null,
          };

      return updater(base);
    });
  }, []);

  const updateManualSource = useCallback(
    (mutator: (manual: ManualSource) => ManualSource) => {
      updateRootingDraft((draft) => {
        const manual = draft.data.sources.manual!;
        const updatedManual = mutator(manual);
        return {
          ...draft,
          data: {
            ...draft.data,
            sources: {
              ...draft.data.sources,
              manual: updatedManual,
            },
          },
        };
      });
    },
    [updateRootingDraft],
  );

  const handleRootingExpiresChange = useCallback(
    (value: string) => {
      updateRootingDraft((draft) => ({
        ...draft,
        expiresAt: value ? new Date(value).toISOString() : nextTuesdayIso(),
      }));
    },
    [updateRootingDraft],
  );

  const handleRootingSourceNameChange = useCallback(
    (value: string) => {
      updateRootingDraft((draft) => ({ ...draft, sourceName: value }));
    },
    [updateRootingDraft],
  );

  const handleRootingAddGame = useCallback(
    (market: MarketKey) => {
      updateManualSource((manual) => ({
        ...manual,
        fetchedAt: new Date().toISOString(),
        markets: {
          ...manual.markets,
          [market]: [...manual.markets[market], createEmptyGame(market)],
        },
      }));
    },
    [updateManualSource],
  );

  const handleRootingRemoveGame = useCallback(
    (market: MarketKey, index: number) => {
      updateManualSource((manual) => ({
        ...manual,
        fetchedAt: new Date().toISOString(),
        markets: {
          ...manual.markets,
          [market]: manual.markets[market].filter((_, idx) => idx !== index),
        },
      }));
    },
    [updateManualSource],
  );

  const handleRootingMatchupChange = useCallback(
    (market: MarketKey, index: number, value: string) => {
      updateManualSource((manual) => ({
        ...manual,
        fetchedAt: new Date().toISOString(),
        markets: {
          ...manual.markets,
          [market]: manual.markets[market].map((game, idx) =>
            idx === index
              ? {
                  ...game,
                  matchup: value,
                }
              : game,
          ),
        },
      }));
    },
    [updateManualSource],
  );

  const handleRootingStartChange = useCallback(
    (market: MarketKey, index: number, value: string) => {
      updateManualSource((manual) => ({
        ...manual,
        fetchedAt: new Date().toISOString(),
        markets: {
          ...manual.markets,
          [market]: manual.markets[market].map((game, idx) =>
            idx === index
              ? {
                  ...game,
                  startISO: value ? new Date(value).toISOString() : null,
                }
              : game,
          ),
        },
      }));
    },
    [updateManualSource],
  );

  const handleRootingTeamChange = useCallback(
    (market: MarketKey, index: number, teamIndex: 0 | 1, value: string) => {
      updateManualSource((manual) => ({
        ...manual,
        fetchedAt: new Date().toISOString(),
        markets: {
          ...manual.markets,
          [market]: manual.markets[market].map((game, idx) => {
            if (idx !== index) return game;
            // infer tuple type directly from the current game's teams
            const nextTeams = [...game.teams] as [typeof game.teams[0], typeof game.teams[1]];
            const trimmed = value.trim();
            const code = trimmed ? getTeamCode(trimmed) ?? trimmed.toUpperCase() : "";
            nextTeams[teamIndex] = {
              ...nextTeams[teamIndex],
              team: code,
              label: code ? getTeamName(code) : "",
            };
            return {
              ...game,
              teams: nextTeams,
            };
          }),
        },
      }));
    },
    [updateManualSource],
  );

  const handleRootingPercentChange = useCallback(
    (
      market: MarketKey,
      index: number,
      teamIndex: 0 | 1,
      field: "betPercent" | "moneyPercent",
      value: string,
    ) => {
      updateManualSource((manual) => ({
        ...manual,
        fetchedAt: new Date().toISOString(),
        markets: {
          ...manual.markets,
          [market]: manual.markets[market].map((game, idx) => {
            if (idx !== index) return game;
            // infer tuple type directly from the current game's teams
            const nextTeams = [...game.teams] as [typeof game.teams[0], typeof game.teams[1]];
            const numeric = value === "" ? null : Number(value);
            const sanitized =
              numeric === null || Number.isNaN(numeric) ? null : Math.max(0, Math.min(100, numeric));
            nextTeams[teamIndex] = {
              ...nextTeams[teamIndex],
              [field]: sanitized,
            };
            return {
              ...game,
              teams: nextTeams,
            };
          }),
        },
      }));
    },
    [updateManualSource],
  );

  const handleRootingLoadLive = useCallback(async () => {
    setRootingAlert(null);
    setRootingWarnings([]);
    try {
      const response = await fetch("/api/rooting-consensus?mode=live", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Live consensus failed (${response.status})`);
      }
      const payload = (await response.json()) as ConsensusApiResponse;
      const seedSource = payload.sources.scoresandodds ?? payload.sources.vsin;
      if (!seedSource) {
        throw new Error("No live consensus data available");
      }
      const manualSource: ManualSource = {
        source: seedSource.source,
        fetchedAt: new Date().toISOString(),
        markets: {
          moneyline: seedSource.markets.moneyline.map((game) => cloneConsensusGame(game)),
          spread: seedSource.markets.spread.map((game) => cloneConsensusGame(game)),
        },
      };
      setRootingDraft((prev) => ({
        data: {
          ...createEmptyConsensus(),
          sources: {
            scoresandodds: null,
            vsin: null,
            manual: manualSource,
          },
        },
        expiresAt: prev?.expiresAt ?? nextTuesdayIso(),
        sourceName: prev?.sourceName ?? seedSource.source,
        sourcePath: prev?.sourcePath,
        textPreview: prev?.textPreview ?? null,
      }));
      setRootingAlert({ tone: "success", message: "Loaded live consensus splits. Review and save to activate." });
    } catch (err: any) {
      setRootingAlert({ tone: "error", message: err?.message ?? "Unable to load live consensus" });
    }
  }, []);

  const handleRootingUpload = useCallback(
    async (file: File) => {
      setRootingAlert(null);
      setRootingUploading(true);
      setRootingWarnings([]);
      try {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/admin/rooting/upload", {
          method: "POST",
          body: form,
        });
        if (!response.ok) {
          let detail = `Upload failed (${response.status})`;
          try {
            const payload = await response.json();
            detail = payload?.detail ?? payload?.error ?? detail;
          } catch {
            // ignore json error
          }
          throw new Error(detail);
        }
        const payload = (await response.json()) as RootingUploadResponse;
        const parsedMatchups = countParsedMatchups(payload.markets ?? null);
        updateRootingDraft((draft) => ({
          ...draft,
          sourceName: payload.sourceName ?? draft.sourceName,
          sourcePath: payload.sourcePath ?? draft.sourcePath,
          textPreview: payload.text ?? draft.textPreview ?? null,
        }));
        if (payload.markets && parsedMatchups > 0) {
          updateManualSource((manual) => ({
            ...manual,
            source: payload.sourceName ?? manual.source,
            fetchedAt: new Date().toISOString(),
            markets: {
              moneyline: payload.markets?.moneyline?.map((game) => cloneConsensusGame(game)) ?? [],
              spread: payload.markets?.spread?.map((game) => cloneConsensusGame(game)) ?? [],
            },
          }));
        } else {
          updateManualSource((manual) => ({
            ...manual,
            source: payload.sourceName ?? manual.source,
            fetchedAt: new Date().toISOString(),
          }));
        }
        setRootingWarnings(payload.warnings ?? []);

        if (parsedMatchups > 0) {
          const message = `PDF parsed. Seeded ${parsedMatchups} matchup${parsedMatchups === 1 ? "" : "s"}. Review and save to activate.`;
          setRootingAlert({ tone: "success", message });
        } else {
          const warningMessage = payload.warnings?.[0] ?? "PDF parsed but no matchups detected. Manual entry required.";
          setRootingAlert({ tone: "error", message: warningMessage });
        }
      } catch (err: any) {
        setRootingAlert({ tone: "error", message: err?.message ?? "Unable to upload PDF" });
      } finally {
        setRootingUploading(false);
      }
    },
    [updateManualSource, updateRootingDraft],
  );

  const handleRootingSave = useCallback(async () => {
    const validationIssues = collectRootingValidationErrors(rootingDraft);
    if (validationIssues.length) {
      setRootingAlert({ tone: "error", message: formatValidationSummary(validationIssues) });
      return;
    }

    if (!rootingDraft) return;
    const manual = rootingDraft.data.sources.manual!;
    setRootingSaving(true);
    setRootingAlert(null);

    try {
      const manualPayload = createEmptyConsensus();
      manualPayload.sources.manual = {
        ...manual,
        fetchedAt: new Date().toISOString(),
      };

      const response = await fetch("/api/admin/rooting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiresAt: rootingDraft.expiresAt,
          sourceName: rootingDraft.sourceName,
          sourcePath: rootingDraft.sourcePath,
          data: manualPayload,
        }),
      });

      if (!response.ok) {
        let detail = `Override update failed (${response.status})`;
        try {
          const payload = await response.json();
          detail = payload?.detail ?? payload?.error ?? detail;
        } catch {
          // ignore
        }
        throw new Error(detail);
      }

      const payload = await response.json();
      const override = payload.override as NonNullable<DashboardData["rootingOverride"]>;
      setRootingDraft({
        data: override.data,
        expiresAt: override.expiresAt,
        sourceName: override.sourceName,
        sourcePath: override.sourcePath,
        textPreview: rootingDraft.textPreview ?? null,
      });
      setDashboard((prev) =>
        prev
          ? { ...prev, rootingOverride: override }
          : {
              analytics: {
                updatedAt: new Date().toISOString(),
                metrics: [],
              },
              note: null,
              errors: [],
              rootingOverride: override,
            },
      );
      setRootingAlert({ tone: "success", message: "Manual rooting override saved." });
    } catch (err: any) {
      setRootingAlert({ tone: "error", message: err?.message ?? "Unable to save rooting override" });
    } finally {
      setRootingSaving(false);
    }
  }, [rootingDraft, setDashboard]);

  const handleRootingClear = useCallback(async () => {
    setRootingAlert(null);
    try {
      const response = await fetch("/api/admin/rooting", { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`Clear override failed (${response.status})`);
      }
      setRootingDraft(null);
      setRootingWarnings([]);
      setDashboard((prev) => (prev ? { ...prev, rootingOverride: null } : prev));
      setRootingAlert({ tone: "success", message: "Manual override cleared. Live consensus restored." });
    } catch (err: any) {
      setRootingAlert({ tone: "error", message: err?.message ?? "Unable to clear override" });
    }
  }, [setDashboard]);

  const manualSource = rootingDraft?.data.sources.manual ?? null;
  const rootingExpiresLabel = rootingDraft?.expiresAt ? describeUpdatedAt(rootingDraft.expiresAt) : "—";
  const rootingTextPreview = rootingDraft?.textPreview?.trim() ?? "";
  const rootingActive = Boolean(dashboard?.rootingOverride);
  const rootingExpiryMin = toLocalDateTimeInput(
    new Date(Date.now() + MIN_OVERRIDE_LEAD_MINUTES * 60 * 1000).toISOString(),
  );

  const syncSelections = useCallback((contestId: ContestId, view: ContestView) => {
    setSelections((prev) => {
      const next: SelectionMap = { ...prev };
      const existing = { ...(next[contestId] ?? {}) };
      view.entries.forEach((entry) => {
        if (existing[entry.name] === undefined) {
          const currentPick = entry.used.find((pick) => pick.week === view.config.currentWeek);
          existing[entry.name] = currentPick?.team ?? "";
        }
      });
      next[contestId] = existing;
      return next;
    });
  }, []);

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [circaRes, scsRes, dashboardRes] = await Promise.all([
        fetch("/api/contest/circa", { cache: "no-store" }),
        fetch("/api/contest/scs", { cache: "no-store" }),
        fetch("/api/system/dashboard", { cache: "no-store" }),
      ]);

      if (!circaRes.ok) throw new Error(`Circa data failed (${circaRes.status})`);
      if (!scsRes.ok) throw new Error(`SuperContest data failed (${scsRes.status})`);
      if (!dashboardRes.ok) throw new Error(`Dashboard data failed (${dashboardRes.status})`);

      const [circaJson, scsJson, dashboardJson] = await Promise.all([
        circaRes.json(),
        scsRes.json(),
        dashboardRes.json(),
      ]);

      const circaView = circaJson.view as ContestView;
      const scsView = scsJson.view as ContestView;
      const dashboardData = dashboardJson as DashboardData;

      setViews({ circa: circaView, scs: scsView });
      setUpdatedAt({
        circa: (circaJson.updatedAt as string | undefined) ?? null,
        scs: (scsJson.updatedAt as string | undefined) ?? null,
      });
      setPicksSummary((circaView.currentWeekSummary as WeekPickSummary | null) ?? null);
      syncSelections("circa", circaView);
      syncSelections("scs", scsView);

      setDashboard(dashboardData);
      const normalized = normalizeMetrics(dashboardData.analytics?.metrics ?? []);
      setAnalyticsDraft(normalized);
      setNoteDraft(dashboardData.note?.message ?? "");
      setNoteAuthor(dashboardData.note?.author ?? "");
      setErrorsData(dashboardData.errors ?? []);
      if (dashboardData.rootingOverride) {
        const manual = dashboardData.rootingOverride.data.sources?.manual;
        setRootingDraft({
          data: dashboardData.rootingOverride.data,
          expiresAt: dashboardData.rootingOverride.expiresAt,
          sourceName: dashboardData.rootingOverride.sourceName ?? manual?.source,
          sourcePath: dashboardData.rootingOverride.sourcePath,
          textPreview: null,
        });
        setRootingWarnings([]);
      } else {
        setRootingDraft(null);
        setRootingWarnings([]);
      }
      setAnalyticsAlert(null);
      setNoteAlert(null);
      setErrorAlert(null);
    } catch (err: any) {
      setError(err?.message ?? "Unable to load admin data");
    } finally {
      setLoading(false);
    }
  }, [syncSelections]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const handlePicksUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) return;

      setPicksAlert(null);
      setPicksUploading(true);

      try {
        const formData = new FormData();
        formData.append("contestId", "circa");
        const currentWeek = views.circa?.config.currentWeek;
        if (currentWeek) {
          formData.append("week", currentWeek);
        }
        formData.append("file", file);

        const response = await fetch("/api/admin/picks/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          let detail = `Picks ingest failed (${response.status})`;
          try {
            const payload = await response.json();
            detail = payload?.detail ?? payload?.error ?? detail;
          } catch {
            // ignore JSON parsing failure
          }
          throw new Error(detail);
        }

        const payload = await response.json();
        const result = payload.result as WeekPickIngestResult;
        setPicksResult(result);
        setPicksSummary(result.summary);

        const formattedTotal = result.summary.totalEntries.toLocaleString();
        setPicksAlert({
          tone: "success",
          message: `Week ${result.week} picks ingested (${formattedTotal} entries).`,
        });

        await fetchAdminData();
      } catch (err: any) {
        setPicksAlert({ tone: "error", message: err?.message ?? "Unable to ingest picks" });
      } finally {
        setPicksUploading(false);
        input.value = "";
      }
    },
    [views, fetchAdminData],
  );

  const analyticsUpdatedLabel = useMemo(
    () => describeUpdatedAt(dashboard?.analytics?.updatedAt),
    [dashboard?.analytics?.updatedAt],
  );

  const noteUpdatedLabel = useMemo(() => describeUpdatedAt(dashboard?.note?.updatedAt), [dashboard?.note?.updatedAt]);

  const picksSummaryEntriesLabel = useMemo(() => {
    if (!picksSummary) return "No upload yet";
    const totalFromSummary = picksSummary.totalEntries ?? 0;
    const fallbackTotal = Object.values(picksSummary.picksByTeam ?? {}).reduce(
      (sum, value) => sum + (Number(value) || 0),
      0,
    );
    const total = totalFromSummary || fallbackTotal;
    return `${total.toLocaleString()} entries`;
  }, [picksSummary]);

  const createMetric = useCallback((): AnalyticsMetric => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `metric-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return {
      id,
      label: "New Metric",
      unit: "",
      value: 0,
      deltas: {
        dod: 0,
        wow: 0,
        mom: 0,
        qoq: 0,
        yoy: 0,
      },
    };
  }, []);

  const handleMetricLabelChange = useCallback((id: string, value: string) => {
    setAnalyticsDraft((prev) => prev.map((metric) => (metric.id === id ? { ...metric, label: value } : metric)));
  }, []);

  const handleMetricUnitChange = useCallback((id: string, value: string) => {
    setAnalyticsDraft((prev) => prev.map((metric) => (metric.id === id ? { ...metric, unit: value } : metric)));
  }, []);

  const handleMetricValueChange = useCallback((id: string, value: string) => {
    const numeric = Number(value);
    setAnalyticsDraft((prev) =>
      prev.map((metric) =>
        metric.id === id
          ? {
              ...metric,
              value: Number.isNaN(numeric) ? 0 : numeric,
            }
          : metric,
      ),
    );
  }, []);

  const handleMetricDeltaChange = useCallback((id: string, key: DeltaKey, value: string) => {
    const numeric = Number(value);
    setAnalyticsDraft((prev) =>
      prev.map((metric) =>
        metric.id === id
          ? {
              ...metric,
              deltas: {
                ...metric.deltas,
                [key]: Number.isNaN(numeric) ? 0 : numeric,
              },
            }
          : metric,
      ),
    );
  }, []);

  const handleAddMetric = useCallback(() => {
    setAnalyticsDraft((prev) => [...prev, createMetric()]);
  }, [createMetric]);

  const handleRemoveMetric = useCallback((id: string) => {
    setAnalyticsDraft((prev) => prev.filter((metric) => metric.id !== id));
  }, []);

  const handleSelectionChange = useCallback((contestId: ContestId, entryName: string, value: string) => {
    setSelections((prev) => ({
      ...prev,
      [contestId]: {
        ...(prev[contestId] ?? {}),
        [entryName]: value,
      },
    }));
  }, []);

  const handleSave = useCallback(
    async (contestId: ContestId, entryName: string) => {
      const view = views[contestId];
      if (!view) return;
      const team = selections[contestId]?.[entryName];
      if (!team) {
        setAlerts((prev) => ({
          ...prev,
          [`${contestId}:${entryName}`]: {
            tone: "error",
            message: "Choose a team before saving.",
          },
        }));
        return;
      }

      setSaving((prev) => ({ ...prev, [contestId]: entryName }));
      try {
        const response = await fetch("/api/admin/picks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contestId,
            entryName,
            week: view.config.currentWeek,
            team,
          }),
        });

        if (!response.ok) {
          let detail = `Save failed (${response.status})`;
          try {
            const payload = await response.json();
            detail = payload?.detail ?? payload?.error ?? detail;
          } catch {
            // ignore json parse error
          }
          throw new Error(detail);
        }

        const payload = await response.json();
        const updatedView = payload.view as ContestView;

        setViews((prev) => ({ ...prev, [contestId]: updatedView }));
        setUpdatedAt((prev) => ({
          ...prev,
          [contestId]: (payload.updatedAt as string | undefined) ?? prev[contestId] ?? null,
        }));
        setSelections((prev) => ({
          ...prev,
          [contestId]: {
            ...(prev[contestId] ?? {}),
            [entryName]: team,
          },
        }));
        syncSelections(contestId, updatedView);
        setAlerts((prev) => ({
          ...prev,
          [`${contestId}:${entryName}`]: {
            tone: "success",
            message: `Saved ${getTeamName(team)} for ${updatedView.currentWeekLabel}.`,
          },
        }));
      } catch (err: any) {
        setAlerts((prev) => ({
          ...prev,
          [`${contestId}:${entryName}`]: {
            tone: "error",
            message: err?.message ?? "Unable to save pick",
          },
        }));
      } finally {
        setSaving((prev) => ({ ...prev, [contestId]: null }));
      }
    },
    [views, selections, syncSelections],
  );

  const handleAnalyticsSave = useCallback(async () => {
    setAnalyticsSaving(true);
    setAnalyticsAlert(null);
    try {
      const metrics = normalizeMetrics(analyticsDraft).map((metric) => ({
        ...metric,
        label: metric.label.trim(),
        unit: metric.unit?.trim() ?? "",
      }));
      const response = await fetch("/api/admin/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updatedAt: new Date().toISOString(),
          metrics,
        }),
      });

      if (!response.ok) {
        let detail = `Analytics update failed (${response.status})`;
        try {
          const payload = await response.json();
          detail = payload?.detail ?? payload?.error ?? detail;
        } catch {
          // ignore json error
        }
        throw new Error(detail);
      }

      const payload = await response.json();
      const snapshot = payload.analytics as DashboardData["analytics"];
      const normalized = normalizeMetrics(snapshot?.metrics ?? []);
      setDashboard((prev) =>
        prev
          ? { ...prev, analytics: snapshot }
          : {
              analytics: snapshot,
              note: null,
              errors: [],
            },
      );
      setAnalyticsDraft(normalized);
      setAnalyticsAlert({ tone: "success", message: "Analytics snapshot updated." });
    } catch (err: any) {
      setAnalyticsAlert({ tone: "error", message: err?.message ?? "Unable to update analytics" });
    } finally {
      setAnalyticsSaving(false);
    }
  }, [analyticsDraft]);

  const handleNoteSave = useCallback(async () => {
    setNoteSaving(true);
    setNoteAlert(null);
    try {
      const response = await fetch("/api/admin/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: noteDraft,
          author: noteAuthor || null,
        }),
      });

      if (!response.ok) {
        let detail = `Note update failed (${response.status})`;
        try {
          const payload = await response.json();
          detail = payload?.detail ?? payload?.error ?? detail;
        } catch {
          // ignore json error
        }
        throw new Error(detail);
      }

      const payload = await response.json();
      const note = payload.note as PinnedNote;
      setDashboard((prev) =>
        prev
          ? { ...prev, note }
          : {
              analytics: {
                updatedAt: new Date().toISOString(),
                metrics: [],
              },
              note,
              errors: [],
            },
      );
      setNoteDraft(note.message ?? "");
      setNoteAuthor(note.author ?? "");
      setNoteAlert({ tone: "success", message: "Pinned note updated." });
    } catch (err: any) {
      setNoteAlert({ tone: "error", message: err?.message ?? "Unable to update note" });
    } finally {
      setNoteSaving(false);
    }
  }, [noteDraft, noteAuthor]);

  const handleErrorStatus = useCallback(
    async (id: string, status: ErrorEntry["status"]) => {
      setErrorAlert(null);
      setErrorUpdatingId(id);
      try {
        const response = await fetch("/api/admin/errors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status }),
        });

        if (!response.ok) {
          let detail = `Error update failed (${response.status})`;
          try {
            const payload = await response.json();
            detail = payload?.detail ?? payload?.error ?? detail;
          } catch {
            // ignore json error
          }
          throw new Error(detail);
        }

        const payload = await response.json();
        const updatedErrors = payload.errors as ErrorEntry[];
        setErrorsData(updatedErrors);
        setDashboard((prev) =>
          prev
            ? { ...prev, errors: updatedErrors }
            : {
                analytics: {
                  updatedAt: new Date().toISOString(),
                  metrics: [],
                },
                note: null,
                errors: updatedErrors,
              },
        );
        const label = status === "resolved" ? "resolved" : status === "open" ? "reopened" : status;
        setErrorAlert({ tone: "success", message: `Error ${id} marked ${label}.` });
      } catch (err: any) {
        setErrorAlert({ tone: "error", message: err?.message ?? "Unable to update error status" });
      } finally {
        setErrorUpdatingId(null);
      }
    },
    [],
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">DeadlineNoon — Admin</div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Survivor Pick Manager</h1>
          <p className="mt-2 text-sm text-slate-400">
            Use the controls below every Saturday to capture partner picks. Each save updates the live dashboard immediately.
          </p>
          <div className="mt-4 inline-flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchAdminData()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Refresh data
              {loading && <span className="text-slate-500">…</span>}
            </button>
        {error && <span className="text-xs text-rose-300">{error}</span>}
      </div>
    </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-inner">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Week Picks Upload</h2>
              <p className="text-sm text-slate-400">
                Drop the official Circa Survivor picks file to refresh Week {views.circa?.config.currentWeek ?? "—"} counts
                and rooting math.
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>{picksSummaryEntriesLabel}</div>
              <div>Updated {describeUpdatedAt(picksSummary?.uploadedAt)}</div>
            </div>
          </div>

          {picksAlert && (
            <div
              className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                picksAlert.tone === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200"
              }`}
            >
              {picksAlert.message}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="file"
              accept=".csv,.tsv,.txt,.json"
              onChange={handlePicksUpload}
              disabled={picksUploading}
              className="block w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500 sm:max-w-sm"
            />
            {picksUploading && <span className="text-xs text-slate-400">Uploading…</span>}
          </div>

          {picksResult && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
              <div className="text-xs uppercase tracking-widest text-slate-500">Last upload summary</div>

              {picksResult.mode === "summary" ? (
                <div className="mt-3 space-y-3">
                  {(() => {
                    const totalFromSummary = picksResult.summary.totalEntries;
                    const calculatedTotal = Object.values(picksResult.summary.picksByTeam).reduce(
                      (sum, value) => sum + (Number(value) || 0),
                      0,
                    );
                    const total = totalFromSummary || calculatedTotal;
                    return (
                      <div>
                        <div className="text-xs uppercase tracking-widest text-slate-500">Top exposures</div>
                        <ul className="mt-1 space-y-1">
                          {Object.entries(picksResult.summary.picksByTeam)
                            .slice(0, 12)
                            .map(([team, rawCount]) => {
                              const count = Number(rawCount) || 0;
                              const percent = total > 0 ? (count / total) * 100 : 0;
                              return (
                                <li key={team} className="flex items-center justify-between gap-3">
                                  <span>{getTeamName(team)} ({team})</span>
                                  <span className="text-xs text-slate-400">
                                    {count.toLocaleString()} · {percent.toFixed(1)}%
                                  </span>
                                </li>
                              );
                            })}
                        </ul>
                      </div>
                    );
                  })()}
                  <div>
                    <div className="text-xs uppercase tracking-widest text-slate-500">Unknown labels</div>
                    {picksResult.unknownTeams.length ? (
                      <ul className="mt-1 space-y-1">
                        {picksResult.unknownTeams.map((team) => (
                          <li key={team} className="text-rose-200">{team}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">None detected.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-2 grid gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-slate-500">Our entries matched</div>
                    {picksResult.matchedEntries.length ? (
                      <ul className="mt-1 space-y-1">
                        {picksResult.matchedEntries.map((entry) => (
                          <li key={entry.name} className="text-slate-200">
                            {entry.name} → {getTeamName(entry.team)} ({entry.team})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">No tracked entries matched.</p>
                    )}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-slate-500">Entries missing</div>
                    {picksResult.missingEntries.length ? (
                      <ul className="mt-1 space-y-1">
                        {picksResult.missingEntries.map((name) => (
                          <li key={name} className="text-amber-200">{name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">All tracked entries present.</p>
                    )}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-slate-500">Unknown teams</div>
                    {picksResult.unknownTeams.length ? (
                      <ul className="mt-1 space-y-1">
                        {picksResult.unknownTeams.map((team) => (
                          <li key={team} className="text-rose-200">{team}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">None detected.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-inner">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Analytics Pulse</h2>
              <p className="text-sm text-slate-400">Track top-line metrics and record DoD/WoW/MoM/QoQ/YoY deltas.</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>Updated {analyticsUpdatedLabel}</div>
              <div>{analyticsDraft.length} KPIs tracked</div>
            </div>
          </div>

          {analyticsAlert && (
            <div
              className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                analyticsAlert.tone === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200"
              }`}
            >
              {analyticsAlert.message}
            </div>
          )}

          <div className="mt-6 space-y-4">
            {analyticsDraft.length ? (
              analyticsDraft.map((metric) => (
                <div key={metric.id} className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_120px_auto] md:items-end">
                    <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-slate-400">
                      <span>KPI Label</span>
                      <input
                        type="text"
                        value={metric.label}
                        onChange={(event) => handleMetricLabelChange(metric.id, event.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none"
                        placeholder="e.g. Total Sessions"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-slate-400">
                      <span>Unit</span>
                      <input
                        type="text"
                        value={metric.unit ?? ""}
                        onChange={(event) => handleMetricUnitChange(metric.id, event.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none"
                        placeholder="%, sessions"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-slate-400">
                      <span>Current Value</span>
                      <input
                        type="number"
                        value={metric.value}
                        onChange={(event) => handleMetricValueChange(metric.id, event.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none"
                        step="0.1"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveMetric(metric.id)}
                      className="self-start rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-400 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-5">
                    {DELTA_KEYS.map((deltaKey) => {
                      const deltaValue = metric.deltas[deltaKey] ?? 0;
                      const badgeClass =
                        deltaValue > 0
                          ? "text-emerald-200"
                          : deltaValue < 0
                          ? "text-rose-200"
                          : "text-slate-300";
                      return (
                        <label
                          key={`${metric.id}-${deltaKey}`}
                          className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs uppercase tracking-widest text-slate-400"
                        >
                          <span>{DELTA_LABELS[deltaKey]}</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={deltaValue}
                              onChange={(event) => handleMetricDeltaChange(metric.id, deltaKey, event.target.value)}
                              className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none"
                              step="0.1"
                            />
                            <span className={`text-xs font-semibold ${badgeClass}`}>
                              {`${deltaValue >= 0 ? "+" : ""}${deltaPreview.format(deltaValue)}%`}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">
                {loading ? "Loading analytics snapshot…" : "No analytics metrics configured. Add a KPI below."}
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleAddMetric}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:border-indigo-400 hover:text-white"
              >
                Add KPI
              </button>
              <button
                type="button"
                onClick={handleAnalyticsSave}
                disabled={analyticsSaving || analyticsDraft.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/60 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:border-indigo-400 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/30 disabled:text-slate-500"
              >
                {analyticsSaving ? "Saving…" : "Save analytics"}
              </button>
            </div>
            <span className="text-xs text-slate-500">Positive deltas glow emerald across the Control Hub; negatives glow rose.</span>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-inner">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Pinned Landing Note</h2>
              <p className="text-sm text-slate-400">Controls the announcement ribbon on the Survivor Control Hub.</p>
            </div>
            <div className="text-right text-xs text-slate-500">Last updated {noteUpdatedLabel}</div>
          </div>

          {noteAlert && (
            <div
              className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                noteAlert.tone === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200"
              }`}
            >
              {noteAlert.message}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-slate-400">
              <span>Message</span>
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={3}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none"
                placeholder="Remind the crew about submission deadlines or strategy callouts."
              />
            </label>
            <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-slate-400 sm:max-w-xs">
              <span>Author (optional)</span>
              <input
                type="text"
                value={noteAuthor}
                onChange={(event) => setNoteAuthor(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none"
                placeholder="George"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleNoteSave}
              disabled={noteSaving || !noteDraft.trim()}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/60 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:border-indigo-400 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/30 disabled:text-slate-500"
            >
              {noteSaving ? "Saving…" : "Save pinned note"}
            </button>
            <span className="text-xs text-slate-500">Message propagates instantly to the Control Hub hero.</span>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-inner">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Rooting Override (PDF Mode)</h2>
              <p className="text-sm text-slate-400">Upload Saturday splits, tweak matchups, and lock them until the Tuesday reset.</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>{rootingActive ? "Manual override active" : "Live consensus"}</div>
              <div>Expires {rootingExpiresLabel}</div>
            </div>
          </div>

          {rootingAlert && (
            <div
              className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                rootingAlert.tone === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200"
              }`}
            >
              {rootingAlert.message}
            </div>
          )}

          {rootingWarnings.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <div className="font-semibold uppercase tracking-widest text-amber-300">Parser notes</div>
              <div className="mt-2 space-y-1 text-amber-100">
                {rootingWarnings.map((warning, index) => (
                  <div key={`rooting-warning-${index}`}>{warning}</div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
                  <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200">
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          handleRootingUpload(file);
                          event.target.value = "";
                        }
                      }}
                    />
                    Upload PDF
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleRootingLoadLive}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 transition hover:border-indigo-400 hover:text-white"
                >
                  Load live consensus
                </button>
                <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
                  <span>Expires</span>
                  <input
                    type="datetime-local"
                    value={toLocalDateTimeInput(rootingDraft?.expiresAt ?? null)}
                    onChange={(event) => handleRootingExpiresChange(event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none"
                    min={rootingExpiryMin}
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={handleRootingClear}
                disabled={!rootingActive}
                className="inline-flex items-center gap-2 self-start rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-400 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/30 disabled:text-slate-500"
              >
                Clear override
              </button>
            </div>

            <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-slate-400 sm:max-w-sm">
              <span>Source label</span>
              <input
                type="text"
                value={rootingDraft?.sourceName ?? ""}
                onChange={(event) => handleRootingSourceNameChange(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none"
                placeholder="Consensus PDF"
              />
            </label>

            {rootingTextPreview && (
              <details className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300">
                <summary className="cursor-pointer text-slate-200">PDF text preview</summary>
                <pre className="mt-3 whitespace-pre-wrap text-[11px] text-slate-300">{rootingTextPreview}</pre>
              </details>
            )}

            {rootingDraft?.sourcePath && (
              <a
                href={rootingDraft.sourcePath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-indigo-300 underline hover:text-indigo-100"
              >
                View uploaded PDF
              </a>
            )}

            {rootingUploading && (
              <div className="text-xs text-slate-400">Parsing PDF…</div>
            )}

            {MARKET_KEYS.map((market) => {
              const games = manualSource?.markets[market] ?? [];
              const heading = MARKET_LABEL[market];
              return (
                <div key={market} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-semibold text-white">{heading}</div>
                    <button
                      type="button"
                      onClick={() => handleRootingAddGame(market)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 transition hover:border-indigo-400 hover:text-white"
                    >
                      Add matchup
                    </button>
                  </div>
                  {games.length ? (
                    <div className="space-y-3">
                      {games.map((game, idx) => (
                        <div key={`${market}-${idx}`} className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <label className="flex flex-1 flex-col gap-1 text-xs uppercase tracking-widest text-slate-400">
                              <span>Matchup</span>
                              <input
                                type="text"
                                value={game.matchup}
                                onChange={(event) => handleRootingMatchupChange(market, idx, event.target.value)}
                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-slate-400">
                              <span>Kickoff (ET)</span>
                              <input
                                type="datetime-local"
                                value={toLocalDateTimeInput(game.startISO)}
                                onChange={(event) => handleRootingStartChange(market, idx, event.target.value)}
                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRootingRemoveGame(market, idx)}
                              className="inline-flex items-center gap-2 self-start rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-400 hover:text-white"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            {[0, 1].map((teamIdx) => {
                              const team = game.teams[teamIdx as 0 | 1];
                              return (
                                <div key={`${market}-${idx}-${teamIdx}`} className="space-y-2 rounded-md border border-slate-800 bg-slate-950/70 p-3">
                                  <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-slate-400">
                                    <span>{teamIdx === 0 ? "Away" : "Home"} team</span>
                                    <input
                                      type="text"
                                      value={team.team}
                                      onChange={(event) =>
                                        handleRootingTeamChange(market, idx, teamIdx as 0 | 1, event.target.value)
                                      }
                                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none"
                                      placeholder="DET"
                                    />
                                  </label>
                                  <div className="grid grid-cols-2 gap-2">
                                    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-slate-400">
                                      <span>% Bets</span>
                                      <input
                                        type="number"
                                        value={team.betPercent ?? ""}
                                        onChange={(event) =>
                                          handleRootingPercentChange(
                                            market,
                                            idx,
                                            teamIdx as 0 | 1,
                                            "betPercent",
                                            event.target.value,
                                          )
                                        }
                                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none"
                                        step="0.1"
                                        min={0}
                                        max={100}
                                        inputMode="decimal"
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-slate-400">
                                      <span>% Money</span>
                                      <input
                                        type="number"
                                        value={team.moneyPercent ?? ""}
                                        onChange={(event) =>
                                          handleRootingPercentChange(
                                            market,
                                            idx,
                                            teamIdx as 0 | 1,
                                            "moneyPercent",
                                            event.target.value,
                                          )
                                        }
                                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none"
                                        step="0.1"
                                        min={0}
                                        max={100}
                                        inputMode="decimal"
                                      />
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">
                      No {heading.toLowerCase()} matchups yet.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleRootingSave}
              disabled={rootingSaving || !manualSource || (!manualSource.markets.moneyline.length && !manualSource.markets.spread.length)}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/60 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:border-indigo-400 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/30 disabled:text-slate-500"
            >
              {rootingSaving ? "Saving…" : "Save manual rooting"}
            </button>
            <span className="text-xs text-slate-500">Override auto-reverts after the expiry window above.</span>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-inner">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Backend Error Log</h2>
              <p className="text-sm text-slate-400">Quick triage for API failures pulled straight from server storage.</p>
            </div>
          </div>

          {errorAlert && (
            <div
              className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                errorAlert.tone === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200"
              }`}
            >
              {errorAlert.message}
            </div>
          )}

          <div className="mt-6 space-y-3">
            {errorsData.length ? (
              errorsData.map((err) => {
                const statusClass =
                  err.status === "resolved"
                    ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-200"
                    : err.status === "investigating"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    : "border-rose-500/40 bg-rose-500/10 text-rose-200";

                return (
                  <div key={err.id} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{err.source}</div>
                        <div className="text-xs text-slate-400">{errorTimeFormatter.format(new Date(err.timestamp))}</div>
                      </div>
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-widest ${statusClass}`}>
                        {err.status}
                        {typeof err.count === "number" && err.count > 0 && (
                          <span className="font-mono text-[10px] text-slate-200">×{err.count}</span>
                        )}
                      </span>
                    </div>
                    <div className="text-sm text-slate-200">{err.message}</div>
                    <div className="flex items-center gap-2">
                      {err.status !== "resolved" && (
                        <button
                          type="button"
                          onClick={() => handleErrorStatus(err.id, "resolved")}
                          disabled={errorUpdatingId === err.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/30 disabled:text-slate-500"
                        >
                          {errorUpdatingId === err.id ? "Updating…" : "Mark resolved"}
                        </button>
                      )}
                      {err.status === "resolved" && (
                        <button
                          type="button"
                          onClick={() => handleErrorStatus(err.id, "open")}
                          disabled={errorUpdatingId === err.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200 transition hover:border-amber-400 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/30 disabled:text-slate-500"
                        >
                          {errorUpdatingId === err.id ? "Updating…" : "Reopen"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">
                {loading ? "Polling backend error log…" : "Clean slate — no backend errors logged."}
              </div>
            )}
          </div>
        </section>

        {loading && !views.circa && !views.scs ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400">
            Loading contest entries…
          </div>
        ) : null}

        {!loading && error && (
          <div className="rounded-2xl border border-rose-600/40 bg-rose-950/40 p-6 text-sm text-rose-100">
            {error}
          </div>
        )}

        {CONTEST_ORDER.map((contestId) => {
          const view = views[contestId];
          if (!view) return null;
          return (
            <ContestSection
              key={contestId}
              contestId={contestId}
              view={view}
              selections={selections[contestId] ?? {}}
              onSelectionChange={(entryName, value) => handleSelectionChange(contestId, entryName, value)}
              onSave={(entryName) => handleSave(contestId, entryName)}
              savingEntry={saving[contestId]}
              alerts={alerts}
              updatedAt={updatedAt[contestId]}
            />
          );
        })}
      </div>
    </main>
  );
}
