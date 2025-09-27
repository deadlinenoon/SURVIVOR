"use client";

import { useCallback, useEffect, useMemo, useState, useId } from "react";
import {
  SPECIAL_GAME_GROUPS,
  SCS_FORCED_WINS,
  TG_BF,
  XMAS,
  getTeamName,
  getTeamLogo,
  formatUSD,
  ContestView,
  EntryView,
  WeekPickSummary,
  WeekKey,
} from "@/lib/survivor";

const SURVIVORSWEAT_MARKETPLACE_URL = "https://survivorsweat.com/marketplace/listings";
import type { PinnedNote } from "@/lib/system-store";
import SCSplit from "@/components/SCSplit";
import RootingTab from "@/components/RootingTab";
import HedgingTab from "@/components/HedgingTab";
import { AvailableTeams } from "@/components/AvailableTeams";
import { UsedTeams, type UsedTeamEntry } from "@/components/UsedTeams";
import { TeamPill } from "@/components/TeamPill";
import MiniGameCard from "@/components/MiniGameCard";
import { useRememberedToggle } from "@/hooks/useRememberedToggle";

type TabKey = "circa" | "scs";
type CircaTabKey = "overview" | "rooting" | "hedge";
type ScsTabKey = "overview" | "rooting" | "hedge";

const noteUpdatedFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

function SummaryCards({
  circa,
  scs,
}: {
  circa: ContestView | null;
  scs: ContestView | null;
}) {
  const cards: Array<{ label: string; view: ContestView | null }> = [
    { label: "Circa Survivor", view: circa },
    { label: "SuperContest Survivor", view: scs },
  ];

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {cards.map(({ label, view }) => {
        const implied = view
          ? view.config.totalPrizePool / Math.max(1, view.config.liveEntries)
          : null;
        const alive = view?.config.liveEntries;
        const initial = view?.config.initialEntries;
        const buyIn = view?.config.buyIn;

        return (
          <div
            key={label}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-inner"
          >
            <div className="text-xs uppercase tracking-widest text-slate-400">{label}</div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {implied !== null ? formatUSD(Math.round(implied)) : "—"}
            </div>
            <div className="mt-2 text-sm text-slate-400">
              {alive !== undefined && initial !== undefined
                ? `${alive.toLocaleString()} alive / ${initial.toLocaleString()} start · buy-in ${
                    buyIn !== undefined ? formatUSD(buyIn) : "—"
                  }`
                : "Loading contest snapshot…"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TabToggle({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <div className="mt-6 inline-flex overflow-hidden rounded-full border border-slate-700 bg-slate-900/80 p-1 text-sm text-slate-300">
      {([
        ["circa", "Circa Survivor"],
        ["scs", "SuperContest Survivor"],
      ] as Array<[TabKey, string]>).map(([key, label]) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            className={`rounded-full px-4 py-2 transition-colors ${
              isActive
                ? "bg-indigo-500 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}


function CircaTabToggle({ active, onChange }: { active: CircaTabKey; onChange: (tab: CircaTabKey) => void }) {
  const tabs: Array<[CircaTabKey, string]> = [
    ["overview", "Overview"],
    ["rooting", "Rooting"],
    ["hedge", "Hedge"],
  ];

  return (
    <div className="mb-6 inline-flex overflow-hidden rounded-full border border-slate-800 bg-slate-950/70 p-1 text-sm">
      {tabs.map(([key, label]) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`rounded-full px-4 py-2 font-semibold transition-colors ${
              isActive ? "bg-indigo-500 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ScsTabToggle({ active, onChange }: { active: ScsTabKey; onChange: (tab: ScsTabKey) => void }) {
  const tabs: Array<[ScsTabKey, string]> = [
    ["overview", "Overview"],
    ["rooting", "Rooting"],
    ["hedge", "Hedge"],
  ];

  return (
    <div className="mb-6 inline-flex overflow-hidden rounded-full border border-slate-800 bg-slate-950/70 p-1 text-sm">
      {tabs.map(([key, label]) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`rounded-full px-4 py-2 font-semibold transition-colors ${
              isActive ? "bg-indigo-500 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function TrackerTable({
  view,
  weekSummary,
}: {
  view: ContestView;
  weekSummary?: WeekPickSummary | null;
}) {
  const title = `${view.activeCount} active / ${view.totalEntries} entries`;
  const picksBadge = weekSummary
    ? `${view.currentWeekLabel}: ${weekSummary.totalEntries.toLocaleString()} picks`
    : null;

  return (
    <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Survivor Tracker</h2>
          <p className="text-xs uppercase tracking-widest text-slate-400">
            {view.currentWeekLabel} · {view.currentWeekDateLabel}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {picksBadge ? (
            <span className="inline-flex items-center rounded-full border border-indigo-400/60 bg-indigo-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-indigo-100">
              {picksBadge}
            </span>
          ) : null}
          <span className="inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">
            {title}
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {view.entries.map((entry) => (
          <TrackerEntryCard
            key={entry.name}
            entry={entry}
            currentWeekLabel={view.currentWeekLabel}
            isCircaContest={view.config.id === "circa"}
            weekBadgeLabel={picksBadge}
            currentWeekKey={view.config.currentWeek}
          />
        ))}
      </div>
    </section>
  );
}

function TrackerEntryCard({
  entry,
  currentWeekLabel,
  isCircaContest,
  weekBadgeLabel,
  currentWeekKey,
}: {
  entry: EntryView;
  currentWeekLabel: string;
  isCircaContest: boolean;
  weekBadgeLabel?: string | null;
  currentWeekKey: WeekKey;
}) {
  const [open, setOpen] = useState(false);
  const reactId = useId();
  const panelId = `tracker-entry-${reactId.replace(/[:]/g, "-")}`;

  const statusLabel = entry.eliminated ? "Eliminated" : "Active";
  const statusStyle = entry.eliminated ? "bg-red-600" : "bg-green-600";

  const usedTeams: UsedTeamEntry[] = entry.used.map((used) => {
    const resultTone = used.result === "W" ? "win" : used.result === "L" ? "loss" : "neutral";
    const resultLabel = used.result === "W" ? "Win" : used.result === "L" ? "Loss" : used.result;
          return {
            id: `${entry.name}-${used.week}`,
            name: used.teamName,
            detail: `${used.label} · ${resultLabel}`,
            result: resultTone,
            icon: getTeamLogo(used.team),
          };
        });

  const availableTeams = entry.availableTeams.map((team) => ({
    id: team.code,
    name: team.name,
    icon: getTeamLogo(team.code),
  }));

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60 shadow-inner transition duration-200 hover:border-slate-700 hover:shadow-lg hover:shadow-black/30">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 hover:bg-slate-900/40"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-500 text-base transition-transform duration-200 ${
              open ? "rotate-45" : "rotate-0"
            }`}
          >
            +
          </span>
          <div>
            <h3 className="text-base font-semibold text-white">{entry.name}</h3>
            {entry.eliminationReason ? (
              <p className="mt-1 text-xs text-slate-400">{entry.eliminationReason}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                Still alive heading into {currentWeekLabel}.
              </p>
            )}
            {entry.used.length > 0 ? (
              <TrackerPickStrip
                picks={entry.used}
                currentWeekKey={currentWeekKey}
              />
            ) : null}
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white ${statusStyle}`}>
          {statusLabel}
        </span>
      </button>

      <div
        id={panelId}
        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
          open ? "max-height-open opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 pb-5">
          <div className="space-y-5 pt-1">
            <UsedTeams entries={usedTeams} />
            <AvailableTeams
              teams={availableTeams}
              emptyLabel="No teams remaining for this entry."
              badgeLabel={weekBadgeLabel ?? undefined}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function TrackerPickStrip({
  picks,
  currentWeekKey,
}: {
  picks: EntryView["used"];
  currentWeekKey: WeekKey;
}) {
  const badgeLabel = (week: WeekKey) => (week && /^\d+$/.test(week) ? `W${week}` : week);

  return (
    <div className="mt-2 flex items-center gap-2">
      {picks.map((pick) => {
        const isCurrent = pick.week === currentWeekKey;
        const logoSrc = getTeamLogo(pick.team);
        const loss = pick.result === "L";
        const baseBorder = loss ? "border border-rose-500" : "border border-slate-600";
        const currentClasses = "border border-indigo-400 shadow shadow-indigo-900/40";
        const badgeText = badgeLabel(pick.week);

        return (
          <div
            key={`${pick.week}-${pick.team}`}
            className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-900/70 ${
              isCurrent ? currentClasses : baseBorder
            }`}
          >
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt={`${pick.teamName} logo`}
                className="h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span className="text-xs font-semibold text-slate-200">{pick.team}</span>
            )}
            {isCurrent ? (
              <span className="absolute -top-1 -right-1 rounded-full bg-indigo-500 px-1 text-[10px] font-semibold text-white shadow-lg">
                {badgeText}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function buildPlayerId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return slug || "player";
}

type SpecialGroup = {
  key: string;
  emoji: string;
  label: string;
  data: typeof TG_GROUP;
};

function SWRPlayerRow({
  entry,
  groups,
  totalSpecialTeams,
  weekBadgeLabel,
}: {
  entry: EntryView;
  groups: SpecialGroup[];
  totalSpecialTeams: number;
  weekBadgeLabel?: string | null;
}) {
  const playerId = buildPlayerId(entry.name);
  const storageKey = `survivor.swr.player.${playerId}.open`;
  const { open, setOpen, mounted } = useRememberedToggle(storageKey, false);
  const panelId = `swr-player-${playerId}`;

  const specialSelected = entry.special.tgUsed + entry.special.xmUsed;
  const showUsageAlert = totalSpecialTeams > 0 && specialSelected / totalSpecialTeams > 0.4;

  const bodyClasses = [
    "overflow-hidden transition-[max-height,opacity] duration-200 ease-out px-3",
    open ? "opacity-100 max-h-[1200px] pb-4" : "opacity-0 max-h-0",
    !mounted && "opacity-0 max-h-0",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 px-3 py-3 text-left transition hover:bg-slate-900/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-500 text-base transition-transform duration-200 ${
              open ? "rotate-45" : "rotate-0"
            }`}
          >
            +
          </span>
          <span className="text-base font-semibold text-white">{entry.name}</span>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs uppercase tracking-widest text-slate-500 sm:flex-row sm:items-center sm:gap-3">
          {weekBadgeLabel ? (
            <span className="inline-flex items-center rounded-full border border-indigo-400/60 bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-100">
              {weekBadgeLabel}
            </span>
          ) : null}
          {showUsageAlert && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/50 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-300 animate-pulse">
              <span aria-hidden>🚨</span>
              <span>↑ 40% SWR TEAMS SELECTED</span>
            </span>
          )}
          <span className="text-xs uppercase tracking-widest text-slate-400">
            🦃 {entry.special.tgUsed}/{TG_BF.length} · 🎄 {entry.special.xmUsed}/{XMAS.length}
          </span>
        </div>
      </button>
      <div id={panelId} className={bodyClasses}>
        <div className="space-y-3 pt-2">
          {groups.map((group) => {
            const contest = group.data!;
            const groupTeams = contest.games.flatMap((game) => [game.away, game.home]);
            const availableList =
              group.key === "TG_BF" ? entry.special.tgAvailable : entry.special.xmAvailable;
            const availableSet = new Set((availableList ?? []).map((team) => team.code));
            const usedSpecialTeams = new Set(
              groupTeams.filter((team) => !availableSet.has(team)),
            );

            return (
              <div key={`${entry.name}-${group.key}`} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
                  <span>{group.emoji}</span>
                  <span>{group.label}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {contest.games.map((game) => {
                    const kickoffLabel = `${game.time} • ${game.date}`;
                    const venueLabel = `@ ${getTeamName(game.home)}`;
                    const awayUsed = usedSpecialTeams.has(game.away);
                    const homeUsed = usedSpecialTeams.has(game.home);
                    const usedTeamForGame = homeUsed ? game.home : awayUsed ? game.away : null;

                    return (
                      <MiniGameCard
                        key={`${entry.name}-${group.key}-${game.away}-${game.home}-${game.date}`}
                        awayTeam={game.away}
                        homeTeam={game.home}
                        kickoff={kickoffLabel}
                        venue={venueLabel}
                        usedTeam={usedTeamForGame}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SpecialReadiness({
  view,
  weekSummary,
}: {
  view: ContestView;
  weekSummary?: WeekPickSummary | null;
}) {
  const groups = [
    { key: "TG_BF", emoji: SPECIAL_EMOJI.TG_BF, label: "Thanksgiving & Black Friday", data: TG_GROUP },
    { key: "XMAS", emoji: SPECIAL_EMOJI.XMAS, label: "Christmas", data: XMAS_GROUP },
  ].filter((group) => group.data) as SpecialGroup[];

  const entriesWithSpecialTeams = view.entries.filter((entry) => {
    const alreadyLost = entry.used.some((pick) => pick.result === "L" || pick.result === "T");
    if (entry.eliminated || alreadyLost) return false;
    return entry.special.tgAvailable.length > 0 || entry.special.xmAvailable.length > 0;
  });

  const itemCount = entriesWithSpecialTeams.length;
  const totalSpecialTeams = TG_BF.length + XMAS.length;
  const picksBadge = weekSummary
    ? `${view.currentWeekLabel}: ${weekSummary.totalEntries.toLocaleString()} picks`
    : null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <h3 className="text-lg font-semibold text-white">Special Week Readiness</h3>
          {picksBadge ? (
            <span className="inline-flex items-center rounded-full border border-indigo-400/60 bg-indigo-500/20 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-indigo-100">
              {picksBadge}
            </span>
          ) : null}
        </div>
        <span className="inline-flex items-center rounded-full bg-slate-700 px-2 py-0.5 text-xs font-semibold text-white/90">
          {itemCount}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-400">Used teams are highlighted in red.</p>
      <div className="mt-4 space-y-3">
        {itemCount === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-400">
            No active entries with special-week teams remaining.
          </p>
        ) : (
          entriesWithSpecialTeams.map((entry) => (
            <SWRPlayerRow
              key={`special-${entry.name}`}
              entry={entry}
              groups={groups}
              totalSpecialTeams={totalSpecialTeams}
              weekBadgeLabel={picksBadge}
            />
          ))
        )}
      </div>
    </section>
  );
}

const SPECIAL_EMOJI: Record<string, string> = {
  TG_BF: "🦃",
  XMAS: "🎄",
};

const TG_GROUP = SPECIAL_GAME_GROUPS.find((group) => group.key === "TG_BF");
const XMAS_GROUP = SPECIAL_GAME_GROUPS.find((group) => group.key === "XMAS");

function CircaOverviewContent({ view }: { view: ContestView }) {
  return (
    <>
      <TrackerTable view={view} weekSummary={view.currentWeekSummary} />
      <SpecialReadiness view={view} weekSummary={view.currentWeekSummary} />
    </>
  );
}

function CircaDashboard({
  view,
  activeTab,
  onTabChange,
}: {
  view: ContestView;
  activeTab: CircaTabKey;
  onTabChange: (tab: CircaTabKey) => void;
}) {
  return (
    <div className="space-y-6">
      <CircaTabToggle active={activeTab} onChange={onTabChange} />
      {activeTab === "overview" && <CircaOverviewContent view={view} />}
      {activeTab === "rooting" && <RootingTab view={view} />}
      {activeTab === "hedge" && <HedgingTab />}
    </div>
  );
}

function SuperContestEntries({ view }: { view: ContestView }) {
  const weeks = ["1", "2", "3"];
  return (
    <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
      <h3 className="text-lg font-semibold text-white">Entries — SuperContest Survivor</h3>
      <p className="mt-1 text-sm text-slate-400">Westgate SuperContest Survivor only. Forced wins: Jaguars → Lions → Chiefs.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-slate-400">
              <th className="pb-3">Entry</th>
              {weeks.map((wk) => (
                <th key={wk} className="pb-3">W{wk}</th>
              ))}
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {view.entries.map((entry) => {
              const statusClass = entry.eliminated ? "text-rose-400" : "text-emerald-400";
              const statusLabel = entry.eliminated ? "Eliminated" : "Alive";
              return (
                <tr key={`scs-${entry.name}`} className="align-top">
                  <td className="py-3 font-medium text-slate-100">{entry.name}</td>
                  {weeks.map((wk) => {
                    const used = entry.used.find((item) => item.week === wk);
                    const forced = SCS_FORCED_WINS[wk];
                    const content = used ? used.teamName : forced ?? "—";
                    const result = used?.result ?? "P";
                    const logoId = used ? used.team : forced;
                    const pillState = result === "W" ? "win" : result === "L" ? "loss" : "neutral";
                    const label = used ? `${content} (${result})` : content;
                    return (
                      <td key={`${entry.name}-${wk}`} className="py-3 text-center">
                        {content === "—" ? (
                          <span className="text-xs text-slate-500">—</span>
                        ) : (
                          <TeamPill
                            name={label}
                            icon={logoId ? getTeamLogo(logoId) : undefined}
                            state={pillState}
                            className="min-w-[7rem] justify-center"
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="py-3">
                    <span className={`text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
                    {entry.eliminationReason && (
                      <div className="mt-1 text-xs text-slate-500">{entry.eliminationReason}</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SuperContestOverviewContent({ view }: { view: ContestView }) {
  return (
    <>
      <TrackerTable view={view} />
      <SuperContestEntries view={view} />
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h3 className="text-lg font-semibold text-white">Hypothetical Win Split</h3>
        <p className="mt-1 text-sm text-slate-400">Example split among the partners if the entry takes down SuperContest Survivor.</p>
        <div className="mt-4">
          <SCSplit />
        </div>
      </section>
    </>
  );
}

function SuperContestDashboard({
  view,
  activeTab,
  onTabChange,
}: {
  view: ContestView;
  activeTab: ScsTabKey;
  onTabChange: (tab: ScsTabKey) => void;
}) {
  return (
    <div className="space-y-6">
      <ScsTabToggle active={activeTab} onChange={onTabChange} />
      {activeTab === "overview" && <SuperContestOverviewContent view={view} />}
      {activeTab === "rooting" && <RootingTab view={view} />}
      {activeTab === "hedge" && <HedgingTab />}
    </div>
  );
}

export default function HomeDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>("circa");
  const [circaTab, setCircaTab] = useState<CircaTabKey>("overview");
  const [scsTab, setScsTab] = useState<ScsTabKey>("overview");
  const [circaView, setCircaView] = useState<ContestView | null>(null);
  const [scsView, setScsView] = useState<ContestView | null>(null);
  const [pinnedNote, setPinnedNote] = useState<PinnedNote | null>(null);
  const [circaUpdatedAt, setCircaUpdatedAt] = useState<string | null>(null);
  const [scsUpdatedAt, setScsUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchViews = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [circaRes, scsRes, dashboardRes] = await Promise.all([
        fetch("/api/contest/circa", { cache: "no-store", signal }),
        fetch("/api/contest/scs", { cache: "no-store", signal }),
        fetch("/api/system/dashboard", { cache: "no-store", signal }),
      ]);

      if (!circaRes.ok) {
        throw new Error(`Failed to load Circa data (${circaRes.status})`);
      }
      if (!scsRes.ok) {
        throw new Error(`Failed to load SuperContest data (${scsRes.status})`);
      }
      if (!dashboardRes.ok) {
        throw new Error(`Failed to load dashboard data (${dashboardRes.status})`);
      }

      const [circaPayload, scsPayload, dashboardPayload] = await Promise.all([
        circaRes.json(),
        scsRes.json(),
        dashboardRes.json(),
      ]);

      if (signal?.aborted) return;

      const { view: circaData, updatedAt: circaTime } = circaPayload;
      const { view: scsData, updatedAt: scsTime } = scsPayload;

      setCircaView(circaData as ContestView);
      setScsView(scsData as ContestView);
      setCircaUpdatedAt((circaTime as string | undefined) ?? null);
      setScsUpdatedAt((scsTime as string | undefined) ?? null);
      setPinnedNote((dashboardPayload?.note as PinnedNote | null) ?? null);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError(err?.message ?? "Unable to load contest dashboards");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchViews(controller.signal);
    return () => controller.abort();
  }, [fetchViews]);

  const lastUpdated = useMemo(() => {
    const stamps = [circaUpdatedAt, scsUpdatedAt].filter((value): value is string => Boolean(value));
    if (!stamps.length) return "—";
    const latest = stamps.reduce((acc, stamp) => {
      const accTime = new Date(acc).getTime();
      const stampTime = new Date(stamp).getTime();
      return stampTime > accTime ? stamp : acc;
    });
    const parsed = new Date(latest);
    if (Number.isNaN(parsed.getTime())) return latest;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    }).format(parsed);
  }, [circaUpdatedAt, scsUpdatedAt]);

  const noteTimestamp = useMemo(() => {
    if (!pinnedNote?.updatedAt) return null;
    const parsed = new Date(pinnedNote.updatedAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return noteUpdatedFormatter.format(parsed);
  }, [pinnedNote?.updatedAt]);

  const renderActiveDashboard = () => {
    if (loading && !circaView && !scsView) {
      return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-400">
          Loading contest dashboards…
        </div>
      );
    }
    if (error) {
      return (
        <div className="rounded-2xl border border-rose-600/40 bg-rose-950/40 p-6 text-sm text-rose-100">
          {error}
        </div>
      );
    }

    if (activeTab === "circa") {
      return circaView ? (
        <CircaDashboard view={circaView} activeTab={circaTab} onTabChange={setCircaTab} />
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-400">
          Circa view not loaded yet.
        </div>
      );
    }

    return scsView ? (
      <SuperContestDashboard view={scsView} activeTab={scsTab} onTabChange={setScsTab} />
    ) : (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-400">
        SuperContest view not loaded yet.
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Survivor Control Hub</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            <span className="text-indigo-400">Deadline</span>Noon — Survivor
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span>Updated: {lastUpdated} ET</span>
            <button
              type="button"
              onClick={() => fetchViews()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Refresh
              {loading && <span className="text-slate-500">…</span>}
            </button>
            <a
              href={SURVIVORSWEAT_MARKETPLACE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-white"
            >
              Sell a slice on SurvivorSweat ↗
            </a>
          </div>
          <SummaryCards circa={circaView} scs={scsView} />
          {pinnedNote?.message ? (
            <div className="mt-4 rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-4 text-sm text-indigo-100 shadow-inner">
              <div>{pinnedNote.message}</div>
              <div className="mt-2 flex flex-col gap-1 text-xs text-indigo-100/80 sm:flex-row sm:items-center sm:justify-between">
                <span>Pinned {noteTimestamp ?? "moments ago"}</span>
                {pinnedNote.author ? <span>— {pinnedNote.author}</span> : null}
              </div>
            </div>
          ) : null}
          <TabToggle active={activeTab} onChange={setActiveTab} />
        </div>

        <main className="mt-6" key={activeTab}>
          {renderActiveDashboard()}
        </main>
      </div>
    </div>
  );
}
