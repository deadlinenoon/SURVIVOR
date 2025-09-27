"use client";

import { useEffect, useMemo, useState } from "react";
import { getTeamCode, getTeamLogo, getTeamName } from "@/lib/survivor";

interface SpreadSide {
  name: string;
  point?: number;
  price?: number;
}

interface Game {
  id: string;
  commence: string;
  awayTeam: string;
  homeTeam: string;
  moneyline: Record<string, number | undefined>;
  spread?: {
    fav?: SpreadSide;
    dog?: SpreadSide;
  };
  totals?: {
    line?: number;
  };
}

interface WeatherInfo {
  emoji: string;
  summary: string;
  wind: string;
  detail: string;
  indoor?: boolean;
  stadium?: {
    name: string;
    city: string;
    state: string;
    indoor: boolean;
  };
}

const DEFAULT_WEATHER: WeatherInfo = {
  emoji: "🏟️",
  summary: "Conditions pending",
  wind: "Waiting for latest forecast",
  detail: "Check back soon for the live weather read at kickoff.",
};

const formatMoneyline = (value?: number) => {
  if (value === undefined || value === null) return "—";
  return value > 0 ? `+${value}` : String(value);
};

const formatSpread = (point?: number, price?: number) => {
  if (point === undefined || point === null) return "—";
  const spread = `${point > 0 ? "+" : ""}${point}`;
  if (price === undefined || price === null) return spread;
  return `${spread} (${formatMoneyline(price)})`;
};

const formatTotal = (value?: number) => {
  if (value === undefined || value === null) return "—";
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
};

function WeatherDetails({ info }: { info: WeatherInfo }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-500"
      >
        <span>{info.emoji}</span>
        <span>{info.summary}</span>
        <span className="ml-auto text-slate-500">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300">
          <div className="font-semibold text-slate-200">Wind</div>
          <div>{info.wind}</div>
          <div className="mt-2 font-semibold text-slate-200">Field Notes</div>
          <div>{info.detail}</div>
          {info.stadium && (
            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Venue</div>
              <div className="mt-1 font-semibold text-slate-200">{info.stadium.name}</div>
              <div className="text-slate-400">
                {info.stadium.city}, {info.stadium.state}
              </div>
              {info.stadium.indoor && (
                <div className="mt-1 text-amber-200">Roof closed — weather neutral.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MatchupCard({ game, weather }: { game: Game; weather?: WeatherInfo }) {
  const weatherInfo = weather ?? DEFAULT_WEATHER;

  const favTeam = game.spread?.fav?.name;
  const awaySpread = favTeam === game.awayTeam ? game.spread?.fav : game.spread?.dog;
  const homeSpread = favTeam === game.homeTeam ? game.spread?.fav : game.spread?.dog;

  const kickoff = useMemo(() => {
    const date = new Date(game.commence);
    const time = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    }).format(date);
    const weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: "America/New_York",
    }).format(date);
    const monthDay = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    }).format(date);
    return { time, label: `${weekday} · ${monthDay}` };
  }, [game.commence]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-inner">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{kickoff.time}</span>
        <span>{kickoff.label}</span>
      </div>
      <div className="mt-3 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        {([
          [game.awayTeam, false, awaySpread],
          [game.homeTeam, true, homeSpread],
        ] as const).map(([team, isHome, spread]) => (
          <div key={team} className="grid grid-cols-[minmax(0,1fr)_80px_60px] items-center gap-2">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getTeamLogo(team)}
                alt={`${getTeamName(team)} logo`}
                className="h-8 w-8 rounded-full border border-slate-700 bg-slate-900"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <div>
                <div className="font-semibold text-slate-100">{getTeamName(team)}</div>
                <div className="text-[11px] uppercase tracking-widest text-slate-500">{isHome ? "Home" : "Away"}</div>
              </div>
            </div>
            <div className="text-sm text-slate-200 text-right">{formatMoneyline(game.moneyline?.[team])}</div>
            <div className="text-sm text-slate-200 text-right">{formatSpread(spread?.point, spread?.price)}</div>
          </div>
        ))}
        <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
          <span>Total</span>
          <span className="font-semibold">O/U {formatTotal(game.totals?.line)}</span>
        </div>
      </div>
      <div className="mt-3">
        <WeatherDetails info={weatherInfo} />
      </div>
    </div>
  );
}

export default function CurrentWeekMatchups() {
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [weatherMap, setWeatherMap] = useState<Record<string, WeatherInfo>>({});
  const [weatherError, setWeatherError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/odds", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load odds (${res.status})`);
        const data = await res.json();
        setGames((data.rows || []) as Game[]);
      } catch (err: any) {
        setError(err?.message ?? "Unable to load odds");
      }
    })();
  }, []);

  const ordered = useMemo(
    () => [...games].sort((a, b) => +new Date(a.commence) - +new Date(b.commence)),
    [games],
  );

  const homeTeamsKey = useMemo(() => {
    const unique = new Set<string>();
    games.forEach((game) => {
      const code = getTeamCode(game.homeTeam);
      if (code) unique.add(code);
    });
    return Array.from(unique).sort().join(",");
  }, [games]);

  useEffect(() => {
    if (!homeTeamsKey) {
      setWeatherMap({});
      return;
    }

    let cancelled = false;
    const search = new URLSearchParams({ teams: homeTeamsKey });

    (async () => {
      try {
        const res = await fetch(`/api/weather?${search.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Weather lookup failed (${res.status})`);
        const payload = await res.json();
        if (cancelled) return;
        setWeatherMap((payload.data ?? {}) as Record<string, WeatherInfo>);
        setWeatherError(null);
      } catch (err: any) {
        if (cancelled) return;
        setWeatherError(err?.message ?? "Unable to load weather");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [homeTeamsKey]);

  if (error) {
    return <div className="rounded-2xl border border-rose-600/40 bg-rose-950/40 p-4 text-sm text-rose-200">{error}</div>;
  }
  if (!ordered.length) {
    return <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-400">No games in the current week window.</div>;
  }

  return (
    <div className="custom-scroll space-y-4 overflow-y-auto pr-2" style={{ maxHeight: 520 }}>
      {weatherError && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
          {weatherError}
        </div>
      )}
      {ordered.map((game) => {
        const homeCode = getTeamCode(game.homeTeam) ?? game.homeTeam;
        return <MatchupCard key={game.id} game={game} weather={weatherMap[homeCode]} />;
      })}
    </div>
  );
}
