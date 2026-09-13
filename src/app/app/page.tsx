import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getActiveImpersonation, getEffectiveUserId } from "@/lib/auth/impersonation";
import { getLearnerOrgId } from "@/lib/learner/get-learner-org";
import { getPublishedContent } from "@/lib/learner/published-content";
import { getStudyRecommendation } from "@/lib/learner/get-study-recommendation";
import { getCertificateProgress } from "@/lib/learner/certificate-progress";
import { WsiPreviewCard } from "@/components/dashboard/wsi-preview-card";
import { CertificateProgressRing } from "@/components/dashboard/certificate-progress-ring";
import { RecentQuizScores } from "@/components/dashboard/recent-quiz-scores";

const QUICK_LINKS = [
  { label: "Modules", href: "/app/modules", blurb: "Structured learning content" },
  { label: "Case Studies", href: "/app/cases", blurb: "Apply skills to real scenarios" },
  { label: "Manual Diff Counter", href: "/app/wbc-diff", blurb: "Practice cell classification" },
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

  const [modules, cases, slideViewsResult, certificatesResult, recommendation, certificateProgress, recentAttempts] =
    await Promise.all([
      getPublishedContent("modules", "module", orgId),
      getPublishedContent("cases", "case", orgId),
      supabase.from("slide_views").select("id", { count: "exact", head: true }).eq("user_id", userId!),
      supabase.from("certificates").select("id", { count: "exact", head: true }).eq("user_id", userId!),
      getStudyRecommendation(supabase, userId!, orgId),
      getCertificateProgress(supabase, userId!),
      supabase
        .from("quiz_attempts")
        .select("id, score, passed, created_at, module_id, case_id, modules(title), cases(title)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const stats = [
    { label: "Modules available", value: modules.length },
    { label: "Case studies available", value: cases.length },
    { label: "Slides reviewed", value: slideViewsResult.count ?? 0 },
    { label: "Certificates earned", value: certificatesResult.count ?? 0 },
  ];

  const quizScores = (recentAttempts.data ?? []).map((a) => ({
    id: a.id,
    title: a.modules?.title ?? a.cases?.title ?? "Untitled",
    score: a.score,
    passed: a.passed,
    createdAt: a.created_at,
  }));

  // The recommendation's slide comes from whichever module/case it points
  // at, so the WSI preview always matches "what to study next."
  let previewSlide: { slideId: string; title: string } | null = null;
  if (recommendation.kind === "module") {
    const { data } = await supabase
      .from("lessons")
      .select("slide_id, title")
      .eq("module_id", recommendation.id)
      .not("slide_id", "is", null)
      .order("position")
      .limit(1)
      .maybeSingle();
    if (data?.slide_id) previewSlide = { slideId: data.slide_id, title: recommendation.title };
  } else if (recommendation.kind === "case") {
    const { data } = await supabase.from("cases").select("slide_id").eq("id", recommendation.id).maybeSingle();
    if (data?.slide_id) previewSlide = { slideId: data.slide_id, title: recommendation.title };
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Welcome, {displayName}</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-dim">
        {orgId ? "Here's what your organization has assigned." : "Here's what's available to study."}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-line p-4">
            <p className="text-xs uppercase text-ink-faint">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      {recommendation.kind !== "none" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-line p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
              {recommendation.reason === "pathway" ? "Continue Learning" : "Study Next"}
            </p>
            <p className="mt-2 text-lg font-medium text-ink">{recommendation.title}</p>
            {"context" in recommendation && recommendation.context && (
              <p className="mt-1 text-sm text-ink-dim">{recommendation.context}</p>
            )}
            <Link
              href={recommendation.href}
              className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
            >
              {recommendation.kind === "module" ? "Continue module" : "Start now"} &rarr;
            </Link>
          </div>
          {previewSlide && (
            <WsiPreviewCard slideId={previewSlide.slideId} slideTitle={previewSlide.title} href={recommendation.href} />
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {certificateProgress && (
          <div className="lg:col-span-1">
            <CertificateProgressRing progress={certificateProgress} />
          </div>
        )}
        <div className={certificateProgress ? "lg:col-span-2" : "lg:col-span-3"}>
          <RecentQuizScores attempts={quizScores} />
        </div>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-ink-faint">Quick access</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-lg border border-line p-4 hover:border-line-strong">
            <p className="font-medium text-ink">{link.label}</p>
            <p className="mt-1 text-sm text-ink-dim">{link.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
