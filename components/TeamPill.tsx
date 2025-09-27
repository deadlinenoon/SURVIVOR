"use client";

import type { ButtonHTMLAttributes } from "react";

export const pillBase =
  "inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 font-semibold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70";

export const pillNeutral = "bg-slate-700 hover:bg-gray-800";
export const pillWin = "bg-green-600 hover:bg-green-700";
export const pillLoss = "bg-red-600 hover:bg-red-700";
export const pillDisabled = "bg-slate-600 text-white/55 cursor-not-allowed";

type TeamPillState = "neutral" | "win" | "loss";

type TeamPillProps = {
  name: string;
  state?: TeamPillState;
  disabled?: boolean;
  icon?: string;
  detail?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "disabled">;

export function TeamPill({
  name,
  state = "neutral",
  disabled,
  icon,
  detail,
  className = "",
  ...props
}: TeamPillProps) {
  const look = disabled
    ? pillDisabled
    : state === "win"
    ? pillWin
    : state === "loss"
    ? pillLoss
    : pillNeutral;

  const composed = [pillBase, look, disabled ? "pointer-events-none" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      className={composed}
      {...props}
    >
      {icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={icon}
          alt=""
          aria-hidden
          className="h-4 w-4 rounded-full border border-white/10 bg-slate-950 object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
      {detail ? (
        <span className="flex min-w-0 flex-col text-left leading-tight">
          <span className="whitespace-nowrap">{name}</span>
          <span className="text-[10px] uppercase tracking-widest text-white/75">
            {detail}
          </span>
        </span>
      ) : (
        <span className="whitespace-nowrap">{name}</span>
      )}
    </button>
  );
}
