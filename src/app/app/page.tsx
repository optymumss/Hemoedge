import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getActiveImpersonation, getEffectiveUserId } from "@/lib/auth/impersonation";
import { getLearnerOrgId } from "@/lib/learner/get-learner-org";
import { getPublishedContent } from "@/lib/learner/published-content";
import { getWeakAreas } from "@/lib/learner/weak-areas";

const QUICK_LINKS = [
  { label: "Modules", href: "/app/modules", blurb: "Structured learning content" },
  { label: "Case Studies", href: "/app/cases", blurb: "Apply skills to real scenarios" },
  { label: "WBC Diff Counter", href: "/app/wbc-diff", blurb: "Practice cell classification" },
  { label: "Library", href: "/app/library", blurb: "Browse the slide collection" },
];

export default async function LearnerHome() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const impersonation = await getActiveImpersonation();
  const userId = await getEffectiveUserId();
  const displayName = impersonation
    ? impersonation.target.fullName || impersonation.target.email
    : profile?.fullName || profile?.email;
  const orgId = await getLearnerOrgId();

  const [modules, cases, slideViewsResult, certificatesResult, weakAreas] = await Promise.all([
    getPublishedContent("modules", "module", orgId),
    getPublishedContent("cases", "case", orgId),
    supabase
      .from("slide_views")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId!),
    supabase
      .from("certificates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId!),
    getWeakAreas(supabase, userId!),
  ]);

  const stats = [
    { label: "Modules available", value: modules.length },
    { label: "Case studies available", value: cases.length },
    { label: "Slides reviewed", value: slideViewsResult.count ?? 0 },
    { label: "Certificates earned", value: certificatesResult.count ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold">Welcome, {displayName}</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-dim">
        {orgId
          ? "Here's what your organization has assigned."
          : "Here's what's available to study."}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-line p-4">
            <p className="text-xs uppercase text-ink-faint">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      {weakAreas.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-ink-faint">
            Where you&apos;re weak
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {weakAreas.map((area) => (
              <div
                key={area.label}
                className="flex items-center justify-between rounded-lg border border-line p-3"
              >
                <span className="text-sm font-medium text-ink">{area.label}</span>
                <span className="text-xs text-warning-soft-ink">
                  {area.accuracyPct}% correct · {area.attempts} attempts
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-ink-faint">
        Continue learning
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-line p-4 transition-colors hover:bg-surface-raised"
          >
            <p className="text-sm font-medium text-ink">{link.label}</p>
            <p className="mt-1 text-xs text-ink-dim">{link.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
