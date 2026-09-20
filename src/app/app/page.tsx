import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getActiveImpersonation, getEffectiveUserId } from "@/lib/auth/impersonation";
import { getLearnerOrgId } from "@/lib/learner/get-learner-org";
import { getPublishedContent } from "@/lib/learner/published-content";
import { getStudyRecommendation } from "@/lib/learner/get-study-recommendation";
import { getCertificateProgress } from "@/lib/learner/certificate-progress";
import { computeSlideProgress, type SlideProgress } from "@/lib/learner/module-slide-progress";
import { getDashboardTrends } from "@/lib/trends/get-dashboard-trends";
import { formatCountTrendLabel, formatPassRateTrendLabel } from "@/lib/learner/format-trend-label";
import { WsiViewerCard } from "@/components/dashboard/wsi-viewer-card";
import { CertificateProgressRing } from "@/components/dashboard/certificate-progress-ring";
import { RecentQuizScores } from "@/components/dashboard/recent-quiz-scores";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ModuleIcon, CaseIcon, PassRateIcon, SlideIcon, LibraryIcon } from "@/components/dashboard/stat-icons";
import { IconBadge } from "@/components/dashboard/icon-badge";

const QUICK_LINKS = [
  { label: "Modules", href: "/app/modules", blurb: "Structured learning content", icon: <ModuleIcon />, accentColor: "red" as const },
  { label: "Case Studies", href: "/app/cases", blurb: "Apply skills to real scenarios", icon: <CaseIcon />, accentColor: "orange" as const },
  { label: "Library", href: "/app/library", blurb: "Browse the slide collection", icon: <LibraryIcon />, accentColor: "purple" as const },
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
  const now = new Date();

  const [modules, cases, certificatesResult, recommendation, certificateProgress, dashboardTrends, recentAttempts] =
    await Promise.all([
      getPublishedContent("modules", "module", orgId),
      getPublishedContent("cases", "case", orgId),
      supabase.from("certificates").select("id", { count: "exact", head: true }).eq("user_id", userId!),
      getStudyRecommendation(supabase, userId!, orgId),
      getCertificateProgress(supabase, userId!, orgId),
      getDashboardTrends(supabase, userId!, now),
      supabase
        .from("quiz_attempts")
        .select("id, score, passed, created_at, module_id, case_id, modules(title), cases(title)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const quizScores = (recentAttempts.data ?? []).map((a) => ({
    id: a.id,
    title: a.modules?.title ?? a.cases?.title ?? "Untitled",
    score: a.score,
    passed: a.passed,
  }));

  // The recommendation's slide comes from whichever module/case it points
  // at, so the WSI viewer always matches "what to study next." For a
  // module recommendation, also compute real per-slide progress for the
  // Continue Learning card — fetching all the module's lesson slides (not
  // just the first) both gives us previewSlide and lets us cross-reference
  // slide_views for the progress bar in one pass.
  let previewSlide: { slideId: string; title: string; href: string } | null = null;
  let slideProgress: SlideProgress | null = null;
  if (recommendation.kind === "module") {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("slide_id, title")
      .eq("module_id", recommendation.id)
      .not("slide_id", "is", null)
      .order("position");
    const lessonRows = lessons ?? [];
    if (lessonRows.length > 0) {
      const firstSlideId = lessonRows[0].slide_id as string;
      previewSlide = { slideId: firstSlideId, title: lessonRows[0].title ?? recommendation.title, href: recommendation.href };

      const lessonSlideIds = lessonRows.map((l) => l.slide_id as string);
      const { data: views } = await supabase
        .from("slide_views")
        .select("slide_id")
        .eq("user_id", userId!)
        .in("slide_id", lessonSlideIds);
      const viewedSlideIds = new Set((views ?? []).map((v) => v.slide_id));
      slideProgress = computeSlideProgress(lessonSlideIds, viewedSlideIds);
    }
  } else if (recommendation.kind === "case") {
    const { data } = await supabase.from("cases").select("slide_id").eq("id", recommendation.id).maybeSingle();
    if (data?.slide_id) previewSlide = { slideId: data.slide_id, title: recommendation.title, href: recommendation.href };
  }

  const statTiles = [
    {
      label: "Modules Started",
      value: String(dashboardTrends.modulesStarted.allTimeTotal),
      icon: <ModuleIcon />,
      changeLabel: formatCountTrendLabel(dashboardTrends.modulesStarted.trend),
      direction: dashboardTrends.modulesStarted.trend.direction,
      sparkline: dashboardTrends.modulesStarted.trend.sparkline,
      accentColor: "red" as const,
    },
    {
      label: "Cases Worked",
      value: String(dashboardTrends.casesWorked.allTimeTotal),
      icon: <CaseIcon />,
      changeLabel: formatCountTrendLabel(dashboardTrends.casesWorked.trend),
      direction: dashboardTrends.casesWorked.trend.direction,
      sparkline: dashboardTrends.casesWorked.trend.sparkline,
      accentColor: "orange" as const,
    },
    {
      label: "Quiz Pass Rate",
      value: dashboardTrends.quizPassRate.allTimePassRate === null ? "—" : `${Math.round(dashboardTrends.quizPassRate.allTimePassRate)}%`,
      icon: <PassRateIcon />,
      changeLabel: formatPassRateTrendLabel(dashboardTrends.quizPassRate.trend),
      direction: dashboardTrends.quizPassRate.trend.direction,
      sparkline: dashboardTrends.quizPassRate.trend.sparkline,
      accentColor: "green" as const,
    },
    {
      label: "Slides Reviewed",
      value: String(dashboardTrends.slidesReviewed.allTimeTotal),
      icon: <SlideIcon />,
      changeLabel: formatCountTrendLabel(dashboardTrends.slidesReviewed.trend),
      direction: dashboardTrends.slidesReviewed.trend.direction,
      sparkline: dashboardTrends.slidesReviewed.trend.sparkline,
      accentColor: "purple" as const,
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold">Welcome, {displayName}</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-dim">
        {orgId ? "Here's what your organization has assigned." : "Here's what's available to study."}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {recommendation.kind !== "none" && (
          <div className="rounded-lg border border-line p-4 lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
              {recommendation.reason === "pathway" ? "Continue Learning" : "Study Next"}
            </p>
            <p className="mt-2 text-lg font-medium text-ink">{recommendation.title}</p>
            {"context" in recommendation && recommendation.context && (
              <p className="mt-1 text-sm text-ink-dim">{recommendation.context}</p>
            )}
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
            <Link
              href={recommendation.href}
              className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
            >
              {recommendation.kind === "module"
                ? recommendation.reason === "pathway"
                  ? "Continue Module"
                  : "Start Module"
                : "Start now"}{" "}
              &rarr;
            </Link>
          </div>
        )}
        <div className={`grid grid-cols-2 gap-3 ${recommendation.kind !== "none" ? "" : "lg:col-span-3"}`}>
          {statTiles.map((tile) => (
            <StatTile key={tile.label} {...tile} />
          ))}
        </div>
      </div>

      {previewSlide && (
        <div className="mt-6">
          <WsiViewerCard slideId={previewSlide.slideId} slideTitle={previewSlide.title} href={previewSlide.href} />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <RecentQuizScores attempts={quizScores} />
        <div className="rounded-lg border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Modules &amp; Cases</p>
          <p className="mt-2 text-sm text-ink-dim">
            {modules.length} modules and {cases.length} case studies available &middot; {certificatesResult.count ?? 0}{" "}
            certificates earned
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {certificateProgress && (
          <div className="lg:col-span-1">
            <CertificateProgressRing progress={certificateProgress} />
          </div>
        )}
        <div className={certificateProgress ? "lg:col-span-2" : "lg:col-span-3"}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-faint">Quick access</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 rounded-lg border border-line p-4 hover:border-line-strong"
              >
                <IconBadge icon={link.icon} accentColor={link.accentColor} />
                <div>
                  <p className="font-medium text-ink">{link.label}</p>
                  <p className="mt-1 text-sm text-ink-dim">{link.blurb}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
