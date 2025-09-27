"use client";

import { useMemo } from "react";
import { StackedBar } from "@/components/StackedBar";
import {
  getTeamLogo,
  getTeamName,
  getTeamPrimaryColor,
  type ContestView,
  type WeekPickSummary,
} from "@/lib/survivor";

type RootingTabProps = {
  view: ContestView | null;
};

type RootingRow = {
  team: string;
  teamName: string;
  ourCount: number;
  opponentCount: number;
  total: number;
  percentOfField: number;
};

const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
const uploadedFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

function formatUploaded(stamp?: string | null): string {
  if (!stamp) return "--";
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return stamp;
  return uploadedFormatter.format(date);
}

function getTeamTotal(picksByTeam: Record<string, number>, teamCode: string): number {
  const normalized = teamCode.toUpperCase();
  if (typeof picksByTeam[normalized] === "number") return picksByTeam[normalized];
  if (typeof picksByTeam[teamCode] === "number") return picksByTeam[teamCode];
  return 0;
}

function buildRootingRows(view: ContestView, summary: WeekPickSummary) {
  const picksByTeam = summary.picksByTeam ?? {};
  const aggregatedTotal =
    summary.totalEntries ||
    Object.values(picksByTeam).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const totalPicks = aggregatedTotal > 0 ? aggregatedTotal : Object.values(picksByTeam).reduce((sum, value) => sum + value, 0);

  const ourCounts = new Map<string, number>();
  view.entries.forEach((entry) => {
    const pick = entry.used.find((item) => item.week === view.config.currentWeek);
    const code = pick?.team?.toUpperCase();
    if (!code) return;
    ourCounts.set(code, (ourCounts.get(code) ?? 0) + 1);
  });

  const rootFor: RootingRow[] = [];
  ourCounts.forEach((ourCount, team) => {
    const total = getTeamTotal(picksByTeam, team) || ourCount;
    if (total <= 0) return;
    const opponentCount = Math.max(total - ourCount, 0);
    rootFor.push({
      team,
      teamName: getTeamName(team),
      ourCount,
      opponentCount,
      total,
      percentOfField: totalPicks > 0 ? (total / totalPicks) * 100 : 0,
    });
  });

  rootFor.sort((a, b) => {
    if (b.ourCount === a.ourCount) return b.total - a.total;
    return b.ourCount - a.ourCount;
  });

  const rootAgainst: RootingRow[] = Object.entries(picksByTeam)
    .map(([team, total]) => {
      const normalized = team.toUpperCase();
      const teamTotal = Number.isFinite(total) ? total : Number(total) || 0;
      const ourCount = ourCounts.get(normalized) ?? 0;
      return {
        team: normalized,
        teamName: getTeamName(normalized),
        ourCount,
        opponentCount: teamTotal,
        total: teamTotal,
        percentOfField: totalPicks > 0 ? (teamTotal / totalPicks) * 100 : 0,
      };
    })
    .filter((row) => row.total > 0 && row.ourCount === 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const ourTotal = Array.from(ourCounts.values()).reduce((sum, value) => sum + value, 0);

  return { rootFor, rootAgainst, totalPicks, ourTotal };
}

function RootingRowCard({ row, variant }: { row: RootingRow; variant: "for" | "against" }) {
  const logo = getTeamLogo(row.team);
  const accentColor = getTeamPrimaryColor(row.team);

  const segments = [
    { label: "Our entries", percent: row.ourCount, color: "bg-emerald-500" },
    {
      label: variant === "against" ? "Opponent entries" : "Other entries",
      percent: row.opponentCount,
      color: variant === "against" ? "bg-rose-500" : "bg-slate-600",
    },
  ];

  const stats =
    variant === "for"
      ? [
          { label: "Our entries", value: row.ourCount, className: "text-emerald-200 font-semibold" },
          { label: "Other entries", value: row.opponentCount, className: "text-slate-300" },
          { label: "Loss eliminates", value: row.total, className: "text-rose-200 font-semibold" },
        ]
      : [
          { label: "Field entries", value: row.total, className: "text-rose-200 font-semibold" },
          { label: "Win survives", value: row.total, className: "text-slate-300" },
          { label: "Loss eliminates", value: row.total, className: "text-rose-200 font-semibold" },
        ];

  return (
    <div className="flex flex-col gap-4 px-4 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        {logo ? (
          <img
            src={logo}
            alt={`${row.teamName} logo`}
            className="h-10 w-10 shrink-0 rounded-full border border-slate-700 bg-slate-950 object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 text-sm font-semibold"
            style={{ backgroundColor: accentColor }}
          >
            {row.team}
          </span>
        )}
        <div>
          <div className="text-sm font-semibold text-white">{row.teamName}</div>
          <div className="text-xs uppercase tracking-widest text-slate-500">
            {row.team} - {percentFormatter.format(row.percentOfField)}% of field
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 lg:max-w-2xl">
        <StackedBar segments={segments} />
        <div className="grid gap-3 text-xs text-slate-300 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className={stat.className}>
              {stat.label}: {numberFormatter.format(stat.value)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RootingSection({
  title,
  subtitle,
  rows,
  variant,
}: {
  title: string;
  subtitle: string;
  rows: RootingRow[];
  variant: "for" | "against";
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/80">
      <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
      {rows.length ? (
        <div className="divide-y divide-slate-800">
          {rows.map((row) => (
            <RootingRowCard key={row.team} row={row} variant={variant} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-6 text-sm text-slate-400">No teams to display yet.</div>
      )}
    </section>
  );
}

export default function RootingTab({ view }: RootingTabProps) {
  const summary = view?.currentWeekSummary;

  if (!view) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-400">
        Loading rooting data...
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-sm text-amber-100">
        Upload the latest picks file to unlock Week {view.currentWeekLabel} rooting analysis.
      </div>
    );
  }

  const { rootFor, rootAgainst, totalPicks, ourTotal } = useMemo(() => buildRootingRows(view, summary), [view, summary]);
  const uploadedLabel = useMemo(() => formatUploaded(summary.uploadedAt), [summary.uploadedAt]);
  const opponentTotal = Math.max(totalPicks - ourTotal, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{view.currentWeekLabel} Rooting Guide</h2>
            <p className="text-sm text-slate-400">
              {numberFormatter.format(totalPicks)} live entries captured. Uploaded {uploadedLabel}.
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Our entries: {numberFormatter.format(ourTotal)}</div>
            <div>Opponents: {numberFormatter.format(opponentTotal)}</div>
          </div>
        </div>
      </section>

      <RootingSection
        title="Teams we need to win"
        subtitle="Our entries ride these teams - keep them alive."
        rows={rootFor}
        variant="for"
      />

      <RootingSection
        title="Teams we'd love to lose"
        subtitle="Heavy opponent exposure - every loss lights up the bracket."
        rows={rootAgainst}
        variant="against"
      />
    </div>
  );
}
