"use client";
import { useEffect, useMemo, useState } from "react";
import { getTeamLogo } from "@/lib/survivor";

type Game = {
  id: string;
  commence: string;
  awayTeam: string;
  homeTeam: string;
  moneyline: Record<string, number | undefined>;
  spread?: {
    fav?: { name: string; point?: number; price?: number };
    dog?: { name: string; point?: number; price?: number };
  };
  totals?: {
    line?: number;
    over?: number;
    under?: number;
  };
};

const fmtKick=(iso:string)=> new Date(iso).toLocaleString(
  undefined,
  {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York"
  }
);
const logo = (team: string) => getTeamLogo(team);

const formatMoneyline=(value?:number)=>{
  if(value===undefined || value===null) return "—";
  return value > 0 ? `+${value}` : String(value);
};

const formatSpread=(point?:number, price?:number)=>{
  if(point===undefined || point===null) return "—";
  const spread = `${point>0?"+":""}${point}`;
  if(price===undefined || price===null) return spread;
  return `${spread} (${formatMoneyline(price)})`;
};

const formatTotal=(value?:number)=>{
  if(value===undefined || value===null) return "—";
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
};

function TeamRow({
  team,
  isHome,
  moneyline,
  spread,
  overUnder,
}: {
  team: string;
  isHome: boolean;
  moneyline?: number;
  spread?: { point?: number; price?: number };
  overUnder?: {
    label: "O" | "U";
    value?: number;
  };
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_80px_80px_70px] items-center gap-3 border-t border-slate-800 py-3 first:border-t-0">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo(team)}
          alt={`${team} logo`}
          className="h-9 w-9 rounded-full border border-slate-800 bg-slate-900 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <div>
          <div className="font-semibold text-slate-100">{team}</div>
          <div className="text-xs uppercase tracking-widest text-slate-500">{isHome ? "Home" : "Away"}</div>
        </div>
      </div>
      <div className="text-right text-sm text-slate-200">{formatMoneyline(moneyline)}</div>
      <div className="text-right text-sm text-slate-200">{formatSpread(spread?.point, spread?.price)}</div>
      <div className="text-right text-sm text-slate-400">
        {overUnder ? `${overUnder.label} ${formatTotal(overUnder.value)}` : "—"}
      </div>
    </div>
  );
}

export default function NFLSchedule(){
  const [rows,setRows]=useState<Game[]>([]), [err,setErr]=useState<string|null>(null), [loading,setLoading]=useState(false);
  useEffect(()=>{(async()=>{
    try{ setLoading(true);
      const r=await fetch("/api/odds",{cache:"no-store"}); if(!r.ok) throw new Error(`odds ${r.status}`);
      const data=await r.json(); setRows((data.rows||[]) as Game[]);
    }catch(e:any){ setErr(String(e?.message||e)); }finally{ setLoading(false); }
  })()},[]);
  const games=useMemo(()=>[...rows].sort((a,b)=>+new Date(a.commence)-+new Date(b.commence)),[rows]);

  if (loading) return <div className="small">Loading schedule…</div>;
  if (err) return <div className="small" style={{color:"#b10000"}}>Failed to load odds: {err}</div>;
  if (!games.length) return <div className="small">No games in the current week window.</div>;

  return (
    <ul className="space-y-4">
      {games.map((g) => {
        const spreadMap: Record<string, { point?: number; price?: number }> = {};
        if (g.spread?.fav) spreadMap[g.spread.fav.name] = { point: g.spread.fav.point, price: g.spread.fav.price };
        if (g.spread?.dog) spreadMap[g.spread.dog.name] = { point: g.spread.dog.point, price: g.spread.dog.price };

        const totalsLine = g.totals?.line;
        const overValue = g.totals?.over ?? totalsLine;
        const underValue = g.totals?.under ?? totalsLine;

        return (
          <li key={g.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="text-xs uppercase tracking-widest text-slate-400">{fmtKick(g.commence)}</div>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_80px_80px_70px] items-center gap-3 text-xs uppercase tracking-widest text-slate-500">
              <span className="text-left text-slate-400">Matchup</span>
              <span className="text-right">Moneyline</span>
              <span className="text-right">Spread</span>
              <span className="text-right">Total</span>
            </div>
            <TeamRow
              team={g.awayTeam}
              isHome={false}
              moneyline={g.moneyline?.[g.awayTeam]}
              spread={spreadMap[g.awayTeam]}
              overUnder={totalsLine != null ? { label: "O", value: overValue } : undefined}
            />
            <TeamRow
              team={g.homeTeam}
              isHome={true}
              moneyline={g.moneyline?.[g.homeTeam]}
              spread={spreadMap[g.homeTeam]}
              overUnder={totalsLine != null ? { label: "U", value: underValue } : undefined}
            />
          </li>
        );
      })}
    </ul>
  );
}
