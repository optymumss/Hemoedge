import Image from "next/image";
import Link from "next/link";
import type { SlideProgress } from "@/lib/learner/module-slide-progress";
import { TargetIcon } from "@/components/dashboard/section-icons";

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
    <div className="relative overflow-hidden rounded-lg border border-line p-3 lg:col-span-2">
      <Image
        src="/brand/sidebar-bloodcells.webp"
        alt=""
        fill
        className="object-cover opacity-20 mix-blend-luminosity"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface/60 to-transparent" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-br from-accent-soft via-transparent to-transparent" aria-hidden="true" />
      <div className="relative">
        <p className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wide text-accent">
          <TargetIcon />
          {label}
        </p>
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
