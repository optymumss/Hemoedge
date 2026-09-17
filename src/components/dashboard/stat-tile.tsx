import type { Sparkline } from "@/lib/trends/trend-math";

const ACCENT_CLASSES: Record<"red" | "orange" | "green" | "purple", { icon: string; spark: string }> = {
  red: { icon: "bg-danger-soft text-danger-soft-ink", spark: "stroke-danger" },
  orange: { icon: "bg-warning-soft text-warning-soft-ink", spark: "stroke-warning" },
  green: { icon: "bg-success-soft text-success-soft-ink", spark: "stroke-success" },
  purple: { icon: "bg-accent-soft text-accent-soft-ink", spark: "stroke-accent" },
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
  accentColor: "red" | "orange" | "green" | "purple";
}) {
  const classes = ACCENT_CLASSES[accentColor];
  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${classes.icon}`} aria-hidden="true">
          {icon}
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      <p className={`text-xs ${DIRECTION_TEXT[direction]}`}>{changeLabel}</p>
      <div className="mt-2">
        <SparklinePath points={sparkline.points} className={classes.spark} />
      </div>
    </div>
  );
}
