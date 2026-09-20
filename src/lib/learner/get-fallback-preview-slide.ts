import { createClient } from "@/lib/supabase/server";
import { pickNewerCandidate, type FallbackCandidate } from "./pick-newer-candidate";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function getNewestCaseWithSlide(
  supabase: Supabase,
  caseIds: string[] | null,
): Promise<FallbackCandidate | null> {
  const query = supabase
    .from("cases")
    .select("id, title, slide_id, created_at")
    .eq("status", "published")
    .not("slide_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const { data } = await (caseIds ? query.in("id", caseIds) : query).maybeSingle();
  if (!data?.slide_id) return null;
  return { slideId: data.slide_id, title: data.title, href: `/app/cases/${data.id}`, createdAt: data.created_at };
}

async function getNewestModuleWithSlide(
  supabase: Supabase,
  moduleIds: string[] | null,
): Promise<FallbackCandidate | null> {
  const query = supabase
    .from("modules")
    .select("id, title, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(20);
  const { data: modules } = await (moduleIds ? query.in("id", moduleIds) : query);

  for (const m of modules ?? []) {
    const { data: lesson } = await supabase
      .from("lessons")
      .select("slide_id, title")
      .eq("module_id", m.id)
      .not("slide_id", "is", null)
      .order("position")
      .limit(1)
      .maybeSingle();
    if (lesson?.slide_id) {
      return { slideId: lesson.slide_id, title: lesson.title, href: `/app/modules/${m.id}`, createdAt: m.created_at };
    }
  }
  return null;
}

async function getOrgScopedFallback(supabase: Supabase, orgId: string): Promise<FallbackCandidate | null> {
  const { data: selections } = await supabase
    .from("org_catalog_selections")
    .select("content_id, content_type")
    .eq("org_id", orgId)
    .in("content_type", ["case", "module"]);

  const caseIds = (selections ?? []).filter((s) => s.content_type === "case").map((s) => s.content_id);
  const moduleIds = (selections ?? []).filter((s) => s.content_type === "module").map((s) => s.content_id);

  return pickNewerCandidate(
    caseIds.length > 0 ? await getNewestCaseWithSlide(supabase, caseIds) : null,
    moduleIds.length > 0 ? await getNewestModuleWithSlide(supabase, moduleIds) : null,
  );
}

/**
 * Guarantees the dashboard's Whole Slide Viewer card always has a slide to
 * show when the platform has any published content with one, even when the
 * learner's own study recommendation doesn't resolve to a slide. Only fills
 * in the WSI card -- the "Continue Learning"/"Study Next" hero card is a
 * separate concern and keeps hiding itself when there's genuinely nothing to
 * recommend.
 */
export async function getFallbackPreviewSlide(
  supabase: Supabase,
  orgId: string | null,
): Promise<{ slideId: string; title: string; href: string } | null> {
  try {
    const orgScoped = orgId ? await getOrgScopedFallback(supabase, orgId) : null;
    const result =
      orgScoped ??
      pickNewerCandidate(await getNewestCaseWithSlide(supabase, null), await getNewestModuleWithSlide(supabase, null));
    return result ? { slideId: result.slideId, title: result.title, href: result.href } : null;
  } catch {
    return null;
  }
}
