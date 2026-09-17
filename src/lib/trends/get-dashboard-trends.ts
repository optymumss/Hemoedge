import type { createClient } from "@/lib/supabase/server";
import { buildTrend, flatTrend, computePassRateTrend, flatPassRateTrend, buildSparkline, DAY_MS } from "./trend-math";
import type { TrendWithSparkline, PassRateTrend } from "./trend-math";

export type { TrendWithSparkline, PassRateTrend };

export interface ActivityMetric {
  allTimeTotal: number;
  trend: TrendWithSparkline;
}

export interface PassRateMetric {
  allTimePassRate: number | null;
  trend: PassRateTrend;
}

export interface DashboardTrends {
  modulesStarted: ActivityMetric;
  casesWorked: ActivityMetric;
  quizPassRate: PassRateMetric;
  slidesReviewed: ActivityMetric;
}

/** Defensive bound against PostgREST's default max-rows cap silently
 * truncating a heavy user's raw-row fetch without an error. */
const RAW_ROW_LIMIT = 10000;

/** A module counts as "started" the first time the learner has any
 * activity tied to it — a quiz attempt, or a slide view on one of its
 * lessons' slides. To classify that first-activity timestamp into the
 * current/previous 30-day window correctly, this needs the learner's
 * ALL-TIME first activity per module, not just activity within the last
 * 60 days — a module started 90 days ago and continued yesterday must not
 * be miscounted as newly-started today. So the raw queries below are
 * unbounded by date (only by RAW_ROW_LIMIT), unlike sub-project B's
 * simpler per-event metrics. The distinct-module count (`.size`) IS the
 * all-time headline total, as a free byproduct of building this map — no
 * extra query needed. */
async function getModulesStartedMetric(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  now: Date,
): Promise<ActivityMetric> {
  try {
    const { data: attempts, error: attemptsError } = await supabase
      .from("quiz_attempts")
      .select("module_id, created_at")
      .eq("user_id", userId)
      .not("module_id", "is", null)
      .order("created_at")
      .limit(RAW_ROW_LIMIT);
    if (attemptsError) {
      console.error("[trends] modulesStarted (quiz_attempts) query failed", attemptsError);
      return { allTimeTotal: 0, trend: flatTrend() };
    }

    const { data: views, error: viewsError } = await supabase
      .from("slide_views")
      .select("slide_id, viewed_at")
      .eq("user_id", userId)
      .order("viewed_at")
      .limit(RAW_ROW_LIMIT);
    if (viewsError) {
      console.error("[trends] modulesStarted (slide_views) query failed", viewsError);
      return { allTimeTotal: 0, trend: flatTrend() };
    }

    const slideIds = Array.from(new Set((views ?? []).map((v) => v.slide_id)));
    const lessonsBySlide = new Map<string, string>();
    if (slideIds.length > 0) {
      const { data: lessons, error: lessonsError } = await supabase
        .from("lessons")
        .select("slide_id, module_id")
        .in("slide_id", slideIds);
      if (lessonsError) {
        console.error("[trends] modulesStarted (lessons) query failed", lessonsError);
        return { allTimeTotal: 0, trend: flatTrend() };
      }
      for (const l of lessons ?? []) {
        if (l.slide_id) lessonsBySlide.set(l.slide_id, l.module_id);
      }
    }

    const firstActivityByModule = new Map<string, Date>();
    const record = (moduleId: string | null | undefined, timestamp: string) => {
      if (!moduleId) return;
      const ts = new Date(timestamp);
      const existing = firstActivityByModule.get(moduleId);
      if (!existing || ts < existing) firstActivityByModule.set(moduleId, ts);
    };

    for (const a of attempts ?? []) record(a.module_id, a.created_at);
    for (const v of views ?? []) record(lessonsBySlide.get(v.slide_id), v.viewed_at);

    return {
      allTimeTotal: firstActivityByModule.size,
      trend: buildTrend(Array.from(firstActivityByModule.values()), now),
    };
  } catch (err) {
    console.error("[trends] modulesStarted threw", err);
    return { allTimeTotal: 0, trend: flatTrend() };
  }
}

/** Same "first activity" pattern as modulesStarted, via quiz_attempts.case_id
 * and slide_views on the case's own slide_id (cases link to a slide
 * directly, no lessons join needed here). */
async function getCasesWorkedMetric(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  now: Date,
): Promise<ActivityMetric> {
  try {
    const { data: attempts, error: attemptsError } = await supabase
      .from("quiz_attempts")
      .select("case_id, created_at")
      .eq("user_id", userId)
      .not("case_id", "is", null)
      .order("created_at")
      .limit(RAW_ROW_LIMIT);
    if (attemptsError) {
      console.error("[trends] casesWorked (quiz_attempts) query failed", attemptsError);
      return { allTimeTotal: 0, trend: flatTrend() };
    }

    const { data: views, error: viewsError } = await supabase
      .from("slide_views")
      .select("slide_id, viewed_at")
      .eq("user_id", userId)
      .order("viewed_at")
      .limit(RAW_ROW_LIMIT);
    if (viewsError) {
      console.error("[trends] casesWorked (slide_views) query failed", viewsError);
      return { allTimeTotal: 0, trend: flatTrend() };
    }

    const slideIds = Array.from(new Set((views ?? []).map((v) => v.slide_id)));
    const casesBySlide = new Map<string, string>();
    if (slideIds.length > 0) {
      const { data: cases, error: casesError } = await supabase
        .from("cases")
        .select("id, slide_id")
        .in("slide_id", slideIds);
      if (casesError) {
        console.error("[trends] casesWorked (cases) query failed", casesError);
        return { allTimeTotal: 0, trend: flatTrend() };
      }
      for (const c of cases ?? []) {
        if (c.slide_id) casesBySlide.set(c.slide_id, c.id);
      }
    }

    const firstActivityByCase = new Map<string, Date>();
    const record = (caseId: string | null | undefined, timestamp: string) => {
      if (!caseId) return;
      const ts = new Date(timestamp);
      const existing = firstActivityByCase.get(caseId);
      if (!existing || ts < existing) firstActivityByCase.set(caseId, ts);
    };

    for (const a of attempts ?? []) record(a.case_id, a.created_at);
    for (const v of views ?? []) record(casesBySlide.get(v.slide_id), v.viewed_at);

    return {
      allTimeTotal: firstActivityByCase.size,
      trend: buildTrend(Array.from(firstActivityByCase.values()), now),
    };
  } catch (err) {
    console.error("[trends] casesWorked threw", err);
    return { allTimeTotal: 0, trend: flatTrend() };
  }
}

async function getQuizPassRateMetric(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sixtyDaysAgoIso: string,
  now: Date,
): Promise<PassRateMetric> {
  try {
    const { data: allTime, error: allTimeError } = await supabase
      .from("quiz_attempts")
      .select("passed")
      .eq("user_id", userId)
      .limit(RAW_ROW_LIMIT);
    if (allTimeError) {
      console.error("[trends] quizPassRate (all-time) query failed", allTimeError);
      return { allTimePassRate: null, trend: flatPassRateTrend() };
    }
    const allTimePassRate =
      allTime && allTime.length > 0 ? (allTime.filter((r) => r.passed).length / allTime.length) * 100 : null;

    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("passed, created_at")
      .eq("user_id", userId)
      .gte("created_at", sixtyDaysAgoIso)
      .order("created_at")
      .limit(RAW_ROW_LIMIT);
    if (error) {
      console.error("[trends] quizPassRate (windowed) query failed", error);
      return { allTimePassRate, trend: flatPassRateTrend() };
    }

    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY_MS);

    let currentPassed = 0;
    let currentTotal = 0;
    let previousPassed = 0;
    let previousTotal = 0;
    for (const row of data ?? []) {
      const ts = new Date(row.created_at);
      if (ts >= thirtyDaysAgo && ts < now) {
        currentTotal++;
        if (row.passed) currentPassed++;
      } else if (ts >= sixtyDaysAgo && ts < thirtyDaysAgo) {
        previousTotal++;
        if (row.passed) previousPassed++;
      }
    }

    const passedTimestamps = (data ?? []).filter((r) => r.passed).map((r) => new Date(r.created_at));

    return {
      allTimePassRate,
      trend: {
        ...computePassRateTrend(currentPassed, currentTotal, previousPassed, previousTotal),
        sparkline: buildSparkline(passedTimestamps, now),
      },
    };
  } catch (err) {
    console.error("[trends] quizPassRate threw", err);
    return { allTimePassRate: null, trend: flatPassRateTrend() };
  }
}

async function getSlidesReviewedMetric(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sixtyDaysAgoIso: string,
  now: Date,
): Promise<ActivityMetric> {
  try {
    const { count, error: countError } = await supabase
      .from("slide_views")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (countError) {
      console.error("[trends] slidesReviewed (all-time count) query failed", countError);
      return { allTimeTotal: 0, trend: flatTrend() };
    }

    const { data, error } = await supabase
      .from("slide_views")
      .select("viewed_at")
      .eq("user_id", userId)
      .gte("viewed_at", sixtyDaysAgoIso)
      .order("viewed_at")
      .limit(RAW_ROW_LIMIT);
    if (error) {
      console.error("[trends] slidesReviewed (windowed) query failed", error);
      return { allTimeTotal: count ?? 0, trend: flatTrend() };
    }
    return { allTimeTotal: count ?? 0, trend: buildTrend((data ?? []).map((r) => new Date(r.viewed_at)), now) };
  } catch (err) {
    console.error("[trends] slidesReviewed threw", err);
    return { allTimeTotal: 0, trend: flatTrend() };
  }
}

export async function getDashboardTrends(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  now: Date,
): Promise<DashboardTrends> {
  const sixtyDaysAgoIso = new Date(now.getTime() - 60 * DAY_MS).toISOString();

  const [modulesStarted, casesWorked, quizPassRate, slidesReviewed] = await Promise.all([
    getModulesStartedMetric(supabase, userId, now),
    getCasesWorkedMetric(supabase, userId, now),
    getQuizPassRateMetric(supabase, userId, sixtyDaysAgoIso, now),
    getSlidesReviewedMetric(supabase, userId, sixtyDaysAgoIso, now),
  ]);

  return { modulesStarted, casesWorked, quizPassRate, slidesReviewed };
}
