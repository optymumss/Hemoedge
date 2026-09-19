"use client";

import { useId } from "react";

/** The hero card's area chart. Same normalization math as stat-tile.tsx's
 * SparklinePath, scaled up, with an accent-tinted fill under the line. The
 * gradient id is unique per instance (useId) so this component is safe to
 * render more than once on a page without one instance's fill silently
 * reusing another's <linearGradient> definition. */
export function ActivityAreaChart({ points }: { points: number[] }) {
  const gradientId = useId();
  const max = Math.max(...points, 1);
  const width = 600;
  const height = 90;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((p, i) => [i * step, height - (p / max) * height] as const);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" strokeWidth="2" className="stroke-accent" />
    </svg>
  );
}
