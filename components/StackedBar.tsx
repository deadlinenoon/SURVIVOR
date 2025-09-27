"use client";

import * as React from "react";

type Segment = {
  label: string;
  percent: number;
  color: string;
};

type StackedBarProps = {
  segments: Segment[];
  height?: number;
};

function normalizeSegments(segments: Segment[]): Segment[] {
  const sanitized = segments.map((segment) => {
    const pct = Number.isFinite(segment.percent) ? Math.max(0, segment.percent) : 0;
    return { ...segment, percent: pct };
  });
  const total = sanitized.reduce((sum, seg) => sum + seg.percent, 0);
  if (total <= 0) {
    return sanitized.map((seg) => ({ ...seg, percent: 0 }));
  }
  return sanitized.map((seg) => ({ ...seg, percent: (seg.percent / total) * 100 }));
}

export function StackedBar({ segments, height = 16 }: StackedBarProps) {
  const normalized = React.useMemo(() => normalizeSegments(segments), [segments]);

  return (
    <div className="w-full">
      <div className="mb-1 flex items-end justify-between text-[11px] text-white/80">
        {normalized.map((segment, index) => (
          <div
            key={`${segment.label}-${index}`}
            style={{ width: `${segment.percent}%` }}
            className="text-center"
          >
            {Math.round(segment.percent)}%
          </div>
        ))}
      </div>
      <div
        className="w-full overflow-hidden rounded-full bg-slate-800"
        style={{ height }}
        role="presentation"
      >
        <div className="flex h-full w-full">
          {normalized.map((segment, index) => {
            const width = `${segment.percent}%`;
            const isHexColor = segment.color.startsWith("#");
            const className = isHexColor ? "" : segment.color;
            const style = isHexColor ? { width, backgroundColor: segment.color } : { width };
            return (
              <div
                key={`${segment.label}-${index}`}
                title={`${segment.label} ${Math.round(segment.percent)}%`}
                className={className}
                style={style}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
