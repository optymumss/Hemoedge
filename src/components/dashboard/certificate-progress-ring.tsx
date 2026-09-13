import type { CertificateProgress } from "@/lib/learner/certificate-progress";

/** A simple SVG ring — no charting library needed for one static value. */
export function CertificateProgressRing({ progress }: { progress: CertificateProgress }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress.percentComplete / 100);

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line p-4">
      <p className="self-start text-xs font-semibold uppercase tracking-wide text-ink-dim">
        Learning &amp; Certificate Progress
      </p>
      <svg width="112" height="112" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <p className="text-2xl font-semibold text-ink">{progress.percentComplete}%</p>
        <p className="text-xs text-ink-dim">
          {progress.completedModules} / {progress.totalModules} modules &middot; {progress.title}
        </p>
      </div>
    </div>
  );
}
