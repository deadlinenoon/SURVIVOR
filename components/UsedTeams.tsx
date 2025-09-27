"use client";

import { TeamPill } from "@/components/TeamPill";

export type UsedTeamEntry = {
  id: string;
  name: string;
  result: "win" | "loss" | "neutral";
  icon?: string;
  disabled?: boolean;
  detail?: string;
};

type UsedTeamsProps = {
  entries: UsedTeamEntry[];
};

export function UsedTeams({ entries }: UsedTeamsProps) {
  return (
    <section className="w-full">
      <h3 className="mb-2 text-xs uppercase tracking-widest text-slate-400">Used Teams</h3>
      {entries.length === 0 ? (
        <p className="rounded-lg bg-slate-900/60 px-3 py-3 text-sm text-slate-400">No teams used yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map((entry) => (
            <TeamPill
              key={entry.id}
              name={entry.name}
              icon={entry.icon}
              state={entry.result === "neutral" ? "neutral" : entry.result}
              disabled={entry.disabled}
              detail={entry.detail}
            />
          ))}
        </div>
      )}
    </section>
  );
}
