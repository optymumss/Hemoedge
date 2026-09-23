import type { Sparkline } from "@/lib/trends/trend-math";
import { IconBadge } from "./icon-badge";
import type { AccentColor } from "./accent-colors";

const SPARK_CLASSES: Record<AccentColor, string> = {
  red: "stroke-danger",
  orange: "stroke-warning",
  green: "stroke-success",
  purple: "stroke-accent",
};

const DIRECTION_TEXT: Record<"up" | "down" | "flat", string> = {
  up: "text-success",
  down: "text-danger",
  flat: "text-ink-faint",
};

function SparklinePath({ points, className }: { points: number[]; className: string }) {
  const max = Math.max(...points, 1);
  const width = 100;
  const height = 24;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(height - (p / max) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-6 w-full" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" strokeWidth="2" className={className} />
    </svg>
  );
}

export function StatTile({
  label,
  value,
  icon,
  changeLabel,
  direction,
  sparkline,
  accentColor,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  changeLabel: string;
  direction: "up" | "down" | "flat";
  sparkline: Sparkline;
  accentColor: AccentColor;
}) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-center gap-2">
        <IconBadge icon={icon} accentColor={accentColor} />
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      <p className={`text-xs ${DIRECTION_TEXT[direction]}`}>{changeLabel}</p>
      <div className="mt-2">
        <SparklinePath points={sparkline.points} className={SPARK_CLASSES[accentColor]} />
      </div>
    </div>
  );
}
