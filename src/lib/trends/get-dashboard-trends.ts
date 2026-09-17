import type { createClient } from "@/lib/supabase/server";
import { computeTrendDelta, buildSparkline, type TrendDelta, type Sparkline } from "./trend-math";

export type TrendWithSparkline = TrendDelta & { sparkline: Sparkline };

export interface DashboardTrends {
  modulesAvailable: TrendWithSparkline;
  caseStudiesAvailable: TrendWithSparkline;
  slidesReviewed: TrendWithSparkline;
  certificatesEarned: TrendWithSparkline;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const FLAT_TREND: TrendWithSparkline = {
  currentPeriodCount: 0,
  previousPeriodCount: 0,
  absoluteChange: 0,
  percentChange: null,
  direction: "flat",
  sparkline: { points: new Array(30).fill(0) },
};

function buildTrend(timestamps: Date[], now: Date): TrendWithSparkline {
  const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY_MS);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  let currentPeriodCount = 0;
  let previousPeriodCount = 0;
  for (const ts of timestamps) {
    if (ts >= thirtyDaysAgo && ts < now) currentPeriodCount++;
    else if (ts >= sixtyDaysAgo && ts < thirtyDaysAgo) previousPeriodCount++;
  }

  return { ...computeTrendDelta(currentPeriodCount, previousPeriodCount), sparkline: buildSparkline(timestamps, now) };
}

/** Shared by modules and cases: matches getPublishedContent()'s own
 * org-catalog-or-global filter exactly, so this trend can never disagree
 * with the headline "available" count it describes. */
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
        .gte("created_at", sixtyDaysAgoIso);
      if (error) return FLAT_TREND;
      if (!selections || selections.length === 0) return buildTrend([], now);

      const { data: published, error: pubError } = await supabase
        .from(table)
        .select("id")
        .eq("status", "published")
        .in(
          "id",
          selections.map((s) => s.content_id),
        );
      if (pubError) return FLAT_TREND;

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
      .gte("created_at", sixtyDaysAgoIso);
    if (error) return FLAT_TREND;
    return buildTrend((data ?? []).map((r) => new Date(r.created_at)), now);
  } catch {
    // A thrown exception (network failure, unexpected client error) must
    // not reject the Promise.all in getDashboardTrends and zero out the
    // other 3 metrics — this metric alone degrades to flat/zero.
    return FLAT_TREND;
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
      .gte("viewed_at", sixtyDaysAgoIso);
    if (error) return FLAT_TREND;
    return buildTrend((data ?? []).map((r) => new Date(r.viewed_at)), now);
  } catch {
    return FLAT_TREND;
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
      .gte("issued_at", sixtyDaysAgoIso);
    if (error) return FLAT_TREND;
    return buildTrend((data ?? []).map((r) => new Date(r.issued_at)), now);
  } catch {
    return FLAT_TREND;
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
