"use client";

import React, { useMemo, type ReactNode } from "react";

export type GameFieldTeam = { name: string; logo: string };
export type GameFieldWeather = {
  tempF?: number | null;
  windSpeedMph?: number | null;
  windDirDeg?: number | null;
  precipType?: "rain" | "snow" | null;
  precipIntensity?: number | null;
  thunderstorm?: boolean;
  indoor?: boolean;
};
export type GameFieldVenue = {
  name: string;
  city?: string;
  state?: string;
  orientationDeg?: number;
};

export interface GameFieldCardProps {
  kickoff: string;
  away: GameFieldTeam;
  home: GameFieldTeam;
  favorite: "home" | "away";
  spread: number;
  total: number;
  weather: GameFieldWeather;
  venue: GameFieldVenue;
}

export default function GameFieldCard({
  kickoff,
  away,
  home,
  favorite,
  spread,
  total,
  weather,
  venue,
}: GameFieldCardProps) {
  const isOutdoor = !weather.indoor;

  const arrow = useMemo(() => {
    if (!isOutdoor) {
      return { rot: 0, len: 0, thick: 0, op: 0, spd: 0, dirDeg: 0 };
    }
    const windDir = weather.windDirDeg ?? 0;
    const speed = Math.max(0, weather.windSpeedMph ?? 0);
    const fieldDeg = venue.orientationDeg ?? 90;
    const towardDeg = normalizeDeg((windDir + 180) % 360);
    const relative = normalizeDeg(towardDeg - fieldDeg);
    return {
      rot: relative,
      len: clamp(map(speed, 0, 35, 16, 90), 0, 120),
      thick: clamp(map(speed, 0, 35, 2, 6), 2, 8),
      op: clamp(map(speed, 0, 35, 0.25, 1), 0.2, 1),
      spd: speed,
      dirDeg: towardDeg,
    };
  }, [isOutdoor, venue.orientationDeg, weather.windDirDeg, weather.windSpeedMph]);

  const favoriteTeam = favorite === "home" ? home : away;
  const underdogTeam = favorite === "home" ? away : home;

  const spreadLabel = formatSpread(spread, "-");
  const dogSpreadLabel = formatSpread(spread, "+");
  const totalLabel = formatNumber(total);
  const temperatureLabel = formatTemperature(weather.tempF);
  const windChipLabel = formatWindChip(weather.windSpeedMph, weather.windDirDeg);
  const windArrowLabel =
    isOutdoor && arrow.spd > 0
      ? `Wind direction and strength: ${Math.round(arrow.spd)} mph toward ${degToCompass(arrow.dirDeg)}`
      : undefined;
  const precipChipLabel = formatPrecipChip(weather.precipType, weather.precipIntensity);

  return (
    <section className="rounded-2xl border border-[var(--dl-line)] bg-[var(--dl-card)] text-[var(--dl-text)] shadow-inner focus-within:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
      <header className="flex flex-col gap-2 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Matchup header">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <TeamHeader team={away} />
          <span className="text-white/50">at</span>
          <TeamHeader team={home} />
        </div>
        <time className="text-xs uppercase tracking-widest text-white/60">{kickoff}</time>
      </header>

      <div className="flex flex-wrap gap-2 px-4 py-3" aria-label="Weather summary">
        <Chip>{temperatureLabel}</Chip>
        {isOutdoor && windChipLabel && <Chip>{windChipLabel}</Chip>}
        {isOutdoor && precipChipLabel && <Chip>{precipChipLabel}</Chip>}
        <Chip>{venue.name}</Chip>
      </div>

      <div className="relative px-4 pb-3">
        <div
          className="relative aspect-[16/9] overflow-hidden rounded-xl"
          style={{ background: "linear-gradient(var(--field-green-dark), var(--field-green))" }}
        >
          <EndZone side="left" />
          <EndZone side="right" />
          {[...Array(9)].map((_, index) => (
            <div key={index} className="absolute inset-y-0 border-l border-white/20" style={{ left: `${10 + index * 10}%` }} />
          ))}
          <div className="absolute inset-y-0 left-[10%] border-l-2 border-white/70" />
          <div className="absolute inset-y-0 right-[10%] border-r-2 border-white/70" />
          <GoalPost side="left" />
          <GoalPost side="right" />

          {isOutdoor && arrow.spd > 0 && (
            <WindArrow
              rotationDeg={arrow.rot}
              lengthPx={arrow.len}
              thicknessPx={arrow.thick}
              opacity={arrow.op}
              ariaLabel={windArrowLabel}
            />
          )}

          {isOutdoor && weather.precipType === "rain" && (weather.precipIntensity ?? 0) > 0 && (
            <RainOverlay intensity={weather.precipIntensity ?? 0} />
          )}

          {isOutdoor && weather.precipType === "snow" && (weather.precipIntensity ?? 0) > 0 && (
            <SnowOverlay intensity={weather.precipIntensity ?? 0} />
          )}

          {isOutdoor && weather.thunderstorm && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45">
              <div className="flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 text-sm font-semibold text-amber-200">
                <span aria-hidden>⚡</span>
                <span>Game Delayed</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="grid grid-cols-3 items-center gap-2 border-t border-[var(--dl-line)] px-4 py-3 text-sm" aria-label="Betting lines">
        <div className="flex items-center gap-2">
          <TeamLogo team={favoriteTeam} />
          <span className="text-white/60">Spread</span>
          <span className="font-semibold">{spreadLabel}</span>
        </div>
        <div className="text-center text-white/80">
          <span className="text-white/60">Total </span>
          <span className="font-semibold text-white">{totalLabel}</span>
        </div>
        <div className="flex items-center justify-end gap-2">
          <span className="font-semibold">{dogSpreadLabel}</span>
          <TeamLogo team={underdogTeam} />
        </div>
      </footer>
    </section>
  );
}

function TeamHeader({ team }: { team: GameFieldTeam }) {
  return (
    <span className="inline-flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={team.logo} alt="" className="h-6 w-6 rounded" loading="lazy" />
      <span className="font-semibold text-white">{team.name}</span>
    </span>
  );
}

function TeamLogo({ team }: { team: GameFieldTeam }) {
  return (
    <span className="inline-flex items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={team.logo} alt="" className="h-6 w-6 rounded" loading="lazy" />
    </span>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--dl-chip)] px-3 py-1 text-xs font-medium text-white/90">
      {children}
    </span>
  );
}

function EndZone({ side }: { side: "left" | "right" }) {
  return <div className={`absolute inset-y-0 w-[10%] bg-black/20 ${side === "left" ? "left-0" : "right-0"}`} aria-hidden />;
}

function GoalPost({ side }: { side: "left" | "right" }) {
  return (
    <div className={`absolute top-1/2 ${side === "left" ? "left-[5%]" : "right-[5%]"} -translate-y-1/2`} aria-hidden>
      <div className="relative h-12 w-8">
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded bg-[var(--goal)]" />
        <div className="absolute right-0 top-0 bottom-0 w-1 rounded bg-[var(--goal)]" />
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded bg-[var(--goal)]" />
        <div className="absolute left-1/2 bottom-0 h-4 w-1 -translate-x-1/2 rounded bg-[var(--goal)]" />
      </div>
    </div>
  );
}

function WindArrow({
  rotationDeg,
  lengthPx,
  thicknessPx,
  opacity,
  ariaLabel,
}: {
  rotationDeg: number;
  lengthPx: number;
  thicknessPx: number;
  opacity: number;
  ariaLabel?: string;
}) {
  const headSize = Math.max(10, Math.min(18, thicknessPx * 3));
  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{ transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`, opacity }}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
    >
      <div className="rounded-full bg-white/90" style={{ height: thicknessPx, width: lengthPx }} />
      <div
        className="-mt-[2px] h-0 w-0 border-y-[8px] border-y-transparent border-l-[14px] border-l-white/90"
        style={{
          marginLeft: Math.max(0, lengthPx - headSize / 2),
          borderLeftWidth: headSize,
          borderTopWidth: headSize / 2,
          borderBottomWidth: headSize / 2,
        }}
      />
    </div>
  );
}

function RainOverlay({ intensity }: { intensity: number }) {
  const level = clamp(intensity, 0, 1);
  const drops = Math.round(70 + level * 150);
  const speed = 600 + (1 - level) * 600;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {[...Array(drops)].map((_, index) => {
        const left = (index * 977) % 100;
        const delay = (index % 40) * -0.12;
        return (
          <span
            key={index}
            className="absolute top-[-12%] h-6 w-[2px] bg-white/30"
            style={{
              left: `${left}%`,
              animation: `raindrop ${speed}ms linear infinite`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
      <style>{`@keyframes raindrop { 0% { transform: translate3d(0,-12%,0); opacity: 0; } 10% { opacity: 0.7; } 100% { transform: translate3d(0,120%,0); opacity: 0; } }`}</style>
    </div>
  );
}

function SnowOverlay({ intensity }: { intensity: number }) {
  const level = clamp(intensity, 0, 1);
  const flakes = Math.round(50 + level * 140);
  const speed = 5000 + (1 - level) * 4000;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {[...Array(flakes)].map((_, index) => {
        const left = (index * 131) % 100;
        const size = 2 + (index % 3);
        const delay = (index % 50) * -0.25;
        return (
          <span
            key={index}
            className="absolute top-[-8%] rounded-full bg-white/80"
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              animation: `snowfall ${speed}ms linear infinite`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
      <style>{`@keyframes snowfall { 0% { transform: translate3d(0,-8%,0) rotate(0deg); opacity: 0; } 15% { opacity: 0.8; } 55% { transform: translate3d(-12%,60%,0) rotate(180deg); } 100% { transform: translate3d(12%,120%,0) rotate(360deg); opacity: 0; } }`}</style>
    </div>
  );
}

function formatTemperature(temp?: number | null) {
  if (temp === undefined || temp === null || Number.isNaN(temp)) {
    return "🌡 —";
  }
  return `🌡 ${Math.round(temp)}°F`;
}

function formatWindChip(speed?: number | null, direction?: number | null) {
  if (speed === undefined || speed === null || speed < 0.5) return null;
  const label = degToCompass(direction ?? 0);
  return `🌬 ${Math.round(speed)} mph ${label}`;
}

function formatPrecipChip(type?: "rain" | "snow" | null, intensity?: number | null) {
  if (!type || intensity === null || intensity === undefined || intensity <= 0) return null;
  const emoji = type === "rain" ? "🌧" : "❄️";
  return `${emoji} ${intensityLabel(intensity)}`;
}

function formatSpread(value: number, sign: "+" | "-") {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 0.05) return "PK";
  const formatted = formatNumber(value);
  return sign === "+" ? `+${formatted}` : `-${formatted}`;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.abs(value % 1) < 0.05 ? Math.round(value) : Number(value.toFixed(1));
  return String(rounded).replace(/\.0$/, "");
}

function map(x: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  const divisor = inMax - inMin;
  const t = divisor === 0 ? 0 : (x - inMin) / divisor;
  return outMin + (outMax - outMin) * t;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDeg(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function degToCompass(deg: number) {
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const index = Math.round(normalizeDeg(deg) / 22.5) % dirs.length;
  return dirs[index];
}

function intensityLabel(intensity: number) {
  const level = clamp(intensity, 0, 1);
  if (level < 0.25) return "Light";
  if (level < 0.6) return "Moderate";
  return "Heavy";
}
