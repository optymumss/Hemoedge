import type { CertificateProgress } from "@/lib/learner/certificate-progress";
import { RibbonIcon } from "@/components/dashboard/section-icons";

/** A simple SVG ring — no charting library needed for one static value. */
export function CertificateProgressRing({ progress }: { progress: CertificateProgress }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress.percentComplete / 100);
  const pointsToNext = progress.totalCpdPoints - progress.earnedCpdPoints;

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-line p-3">
      <p className="flex items-center gap-1.5 self-start font-display text-xs font-bold uppercase tracking-wide text-accent">
        <RibbonIcon />
        CPD Progress
      </p>
      <svg width="88" height="88" viewBox="0 0 96 96" className="-rotate-90" aria-hidden="true">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="var(--success)"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <p className="text-2xl font-semibold text-ink">{progress.percentComplete}%</p>
        <p className="text-xs text-ink-dim">
          {progress.earnedCpdPoints} / {progress.totalCpdPoints} CPD points
        </p>
        {pointsToNext > 0 && <p className="mt-1 text-xs text-ink-faint">{pointsToNext} points to next certificate</p>}
      </div>
    </div>
  );
}
