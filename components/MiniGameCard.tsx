import React from "react";
import { getTeamLogo } from "@/lib/survivor";

interface MiniGameCardProps {
  awayTeam: string;
  homeTeam: string;
  kickoff: string;
  venue: string;
  usedTeam?: string | null;
}

export default function MiniGameCard({
  awayTeam,
  homeTeam,
  kickoff,
  venue,
  usedTeam = null,
}: MiniGameCardProps) {
  const renderTeam = (team: string) => {
    const logo = getTeamLogo(team);
    const isUsed = usedTeam === team;
    return (
      <div
        className={`flex items-center gap-1 rounded-md px-2 py-1 ${
          isUsed ? "bg-rose-500 text-white" : "bg-slate-700 text-slate-200"
        }`}
      >
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={`${team} logo`} className="h-3 w-3 object-contain" />
        )}
        <span className="text-xs font-medium">{team}</span>
      </div>
    );
  };

  return (
    <div className="w-40 rounded-lg bg-slate-800 p-2 text-center">
      {renderTeam(awayTeam)}
      {renderTeam(homeTeam)}
      <div className="mt-1 text-[10px] text-slate-400">
        {kickoff} · {venue}
      </div>
    </div>
  );
}
