import Link from "next/link";
import type { SlideProgress } from "@/lib/learner/module-slide-progress";

export function DashboardHeroCard({
  label,
  title,
  context,
  slideProgress,
  ctaHref,
  ctaLabel,
}: {
  label: string;
  title: string;
  context?: string | null;
  slideProgress: SlideProgress | null;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-line p-4 lg:col-span-2">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full text-accent opacity-[0.08]"
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <circle cx="40" cy="40" r="28" fill="currentColor" />
        <circle cx="120" cy="90" r="36" fill="currentColor" />
        <circle cx="90" cy="150" r="20" fill="currentColor" />
        <circle cx="210" cy="50" r="18" fill="currentColor" />
        <circle cx="260" cy="120" r="44" fill="currentColor" />
        <circle cx="330" cy="60" r="24" fill="currentColor" />
        <circle cx="360" cy="150" r="30" fill="currentColor" />
        <circle cx="180" cy="170" r="14" fill="currentColor" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-br from-accent-soft via-transparent to-transparent" aria-hidden="true" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">{label}</p>
        <p className="mt-2 text-lg font-medium text-ink">{title}</p>
        {context && <p className="mt-1 text-sm text-ink-dim">{context}</p>}
        {slideProgress && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-accent" style={{ width: `${slideProgress.percent}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-dim">
              {slideProgress.completed} of {slideProgress.total} slides completed &middot; {slideProgress.percent}%
            </p>
          </div>
        )}
        <Link href={ctaHref} className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
          {ctaLabel} &rarr;
        </Link>
      </div>
    </div>
  );
}
