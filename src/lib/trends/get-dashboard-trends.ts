import type { createClient } from "@/lib/supabase/server";
import { buildTrend, flatTrend, DAY_MS } from "./trend-math";
import type { TrendWithSparkline } from "./trend-math";

export type { TrendWithSparkline };

export interface DashboardTrends {
  modulesAvailable: TrendWithSparkline;
  caseStudiesAvailable: TrendWithSparkline;
  slidesReviewed: TrendWithSparkline;
  certificatesEarned: TrendWithSparkline;
}

/** Defensive bound against PostgREST's default max-rows cap silently
 * truncating a heavy user's/org's raw-timestamp fetch without an error.
 * 10000 rows over a 60-day window is far beyond any realistic activity
 * volume for these metrics in this app. */
const RAW_ROW_LIMIT = 10000;

/** Shared by modules and cases: matches getPublishedContent()'s
 * org-catalog-or-global filter (org_id/content_type/status='published')
 * to decide which items are "available." Uses org_catalog_selections
 * .created_at (org-scoped) or the content row's own created_at
 * (individual) as the "became available" timestamp — an approximation,
 * since neither table has a dedicated publish-transition timestamp, so
 * this trend can occasionally lag getPublishedContent()'s headline count
 * for content whose org-selection or creation happened outside the
 * 60-day window but whose status flipped to 'published' inside it. */
async function getContentAvailabilityTrend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "modules" | "cases",
  contentType: "module" | "case",
  orgId: string | null,
  sixtyDaysAgoIso: string,
  now: Date,
): Promise<TrendWithSparkline> {
  try {
    if (orgId) {
      const { data: selections, error } = await supabase
        .from("org_catalog_selections")
        .select("content_id, created_at")
        .eq("org_id", orgId)
        .eq("content_type", contentType)
        .gte("created_at", sixtyDaysAgoIso)
        .order("created_at")
        .limit(RAW_ROW_LIMIT);
      if (error) {
        console.error(`[trends] ${table} availability (org-scoped selections) query failed`, error);
        return flatTrend();
      }
      if (!selections || selections.length === 0) return buildTrend([], now);

      const { data: published, error: pubError } = await supabase
        .from(table)
        .select("id")
        .eq("status", "published")
        .in(
          "id",
          selections.map((s) => s.content_id),
        );
      if (pubError) {
        console.error(`[trends] ${table} availability (published lookup) query failed`, pubError);
        return flatTrend();
      }

      const publishedIds = new Set((published ?? []).map((p) => p.id));
      const timestamps = selections
        .filter((s) => publishedIds.has(s.content_id))
        .map((s) => new Date(s.created_at));
      return buildTrend(timestamps, now);
    }

    const { data, error } = await supabase
      .from(table)
      .select("created_at")
      .eq("status", "published")
      .gte("created_at", sixtyDaysAgoIso)
      .order("created_at")
      .limit(RAW_ROW_LIMIT);
    if (error) {
      console.error(`[trends] ${table} availability query failed`, error);
      return flatTrend();
    }
    return buildTrend((data ?? []).map((r) => new Date(r.created_at)), now);
  } catch (err) {
    console.error(`[trends] ${table} availability threw`, err);
    return flatTrend();
  }
}

async function getSlidesReviewedTrend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sixtyDaysAgoIso: string,
  now: Date,
): Promise<TrendWithSparkline> {
  try {
    const { data, error } = await supabase
      .from("slide_views")
      .select("viewed_at")
      .eq("user_id", userId)
      .gte("viewed_at", sixtyDaysAgoIso)
      .order("viewed_at")
      .limit(RAW_ROW_LIMIT);
    if (error) {
      console.error("[trends] slidesReviewed query failed", error);
      return flatTrend();
    }
    return buildTrend((data ?? []).map((r) => new Date(r.viewed_at)), now);
  } catch (err) {
    console.error("[trends] slidesReviewed threw", err);
    return flatTrend();
  }
}

async function getCertificatesEarnedTrend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sixtyDaysAgoIso: string,
  now: Date,
): Promise<TrendWithSparkline> {
  try {
    const { data, error } = await supabase
      .from("certificates")
      .select("issued_at")
      .eq("user_id", userId)
      .gte("issued_at", sixtyDaysAgoIso)
      .order("issued_at")
      .limit(RAW_ROW_LIMIT);
    if (error) {
      console.error("[trends] certificatesEarned query failed", error);
      return flatTrend();
    }
    return buildTrend((data ?? []).map((r) => new Date(r.issued_at)), now);
  } catch (err) {
    console.error("[trends] certificatesEarned threw", err);
    return flatTrend();
  }
}

export async function getDashboardTrends(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string | null,
  now: Date,
): Promise<DashboardTrends> {
  const sixtyDaysAgoIso = new Date(now.getTime() - 60 * DAY_MS).toISOString();

  const [modulesAvailable, caseStudiesAvailable, slidesReviewed, certificatesEarned] = await Promise.all([
    getContentAvailabilityTrend(supabase, "modules", "module", orgId, sixtyDaysAgoIso, now),
    getContentAvailabilityTrend(supabase, "cases", "case", orgId, sixtyDaysAgoIso, now),
    getSlidesReviewedTrend(supabase, userId, sixtyDaysAgoIso, now),
    getCertificatesEarnedTrend(supabase, userId, sixtyDaysAgoIso, now),
  ]);

  return { modulesAvailable, caseStudiesAvailable, slidesReviewed, certificatesEarned };
}
