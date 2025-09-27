"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { TeamPill } from "@/components/TeamPill";
import { TG_BF, XMAS } from "@/lib/survivor";

const STORAGE_KEY = "survivor.available.open";

const SPECIAL_TEAM_LABELS: Record<string, string> = (() => {
  const labels: Record<string, string> = {};
  TG_BF.forEach((team) => {
    labels[team] = "Thanksgiving / Black Friday";
  });
  XMAS.forEach((team) => {
    labels[team] = labels[team]
      ? `${labels[team]} + Christmas`
      : "Christmas Slate";
  });
  return labels;
})();

const SPECIAL_PILL_CLASSES =
  "border border-amber-300 !bg-amber-500 !text-slate-900 hover:!bg-amber-400";

export type AvailableTeam = {
  id: string;
  name: string;
  icon?: string;
  disabled?: boolean;
};

type AvailableTeamsProps = {
  teams: AvailableTeam[];
  emptyLabel?: string;
  badgeLabel?: string;
};

export function AvailableTeams({ teams, emptyLabel, badgeLabel }: AvailableTeamsProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const reactId = useId();
  const panelId = useMemo(() => `available-teams-${reactId.replace(/[:]/g, "-")}`, [reactId]);
  const count = teams?.length ?? 0;
  const showFilter = count > 10;
  const filterId = `${panelId}-filter`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setOpen(stored === "1");
        return;
      }
    } catch (error) {
      console.error("Failed to read available teams state", error);
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch (error) {
      console.error("Failed to persist available teams state", error);
    }
  }, [open]);

  const filteredTeams = useMemo(() => {
    if (!query.trim()) return teams;
    const needle = query.trim().toLowerCase();
    return teams.filter((team) => team.name.toLowerCase().includes(needle));
  }, [teams, query]);

  return (
    <section className="w-full">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className="group flex w-full items-center justify-between gap-3 rounded-xl bg-slate-800/70 px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 hover:bg-slate-800"
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-500 text-base transition-transform duration-200 ${
              open ? "rotate-45" : "rotate-0"
            }`}
          >
            +
          </span>
          <span className="font-semibold text-slate-100">Available Teams</span>
          <span className="ml-2 inline-flex items-center rounded-full bg-slate-700 px-2 py-0.5 text-xs font-semibold text-white/90">
            {count}
          </span>
        </div>
        {badgeLabel ? (
          <span className="inline-flex items-center rounded-full border border-indigo-400/60 bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-indigo-100">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      <div
        id={panelId}
        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
          open ? "mt-3 max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {count === 0 ? (
          <p className="rounded-lg bg-slate-900/60 px-3 py-4 text-sm text-slate-400">
            {emptyLabel ?? "No teams remaining for this entry."}
          </p>
        ) : (
          <div className="rounded-xl bg-slate-900/40 px-3 py-3">
            {showFilter && (
              <div className="mb-3">
                <label htmlFor={filterId} className="sr-only">
                  Filter available teams
                </label>
                <input
                  id={filterId}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter teams…"
                  className="w-full rounded-lg bg-slate-900/80 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
                />
              </div>
            )}

            {filteredTeams.length === 0 ? (
              <p className="rounded-lg bg-slate-900/40 px-3 py-3 text-sm text-slate-400">
                No teams match {query ? `“${query.trim()}”` : "that filter"}.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredTeams.map((team) => {
                  const specialLabel = SPECIAL_TEAM_LABELS[team.id];
                  const detail = specialLabel ? `⚠︎ ${specialLabel}` : undefined;
                  const pillClasses = specialLabel ? SPECIAL_PILL_CLASSES : undefined;
                  const ariaLabel = specialLabel ? `${team.name} — ${specialLabel}` : undefined;
                  return (
                    <TeamPill
                      key={team.id}
                      name={team.name}
                      icon={team.icon}
                      disabled={team.disabled}
                      detail={detail}
                      className={pillClasses}
                      aria-label={ariaLabel}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
