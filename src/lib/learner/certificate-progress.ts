import { createClient } from "@/lib/supabase/server";

export type CertificateProgress = {
  curriculumId: string;
  title: string;
  percentComplete: number;
  completedModules: number;
  totalModules: number;
};

export type CurriculumForProgress = {
  curriculumId: string;
  title: string;
  certificateAwarded: boolean;
  modules: { bestScore: number | null; passThreshold: number }[];
};

/**
 * Picks which certificate-awarding curriculum to show progress toward on
 * the dashboard: whichever the learner is closest to finishing, so the
 * ring always reflects the certificate nearest in reach. Falls back to an
 * unstarted certificate curriculum (0%) if none are in progress yet, so a
 * brand-new learner still sees what they're working toward.
 */
export function pickCertificateProgress(curricula: CurriculumForProgress[]): CertificateProgress | null {
  const scored = curricula
    .filter((c) => c.certificateAwarded && c.modules.length > 0)
    .map((c) => {
      const completedModules = c.modules.filter((m) => m.bestScore !== null && m.bestScore >= m.passThreshold).length;
      const percentComplete = Math.round((completedModules / c.modules.length) * 100);
      return {
        curriculumId: c.curriculumId,
        title: c.title,
        percentComplete,
        completedModules,
        totalModules: c.modules.length,
      };
    });

  if (scored.length === 0) return null;

  const inProgress = scored.filter((c) => c.percentComplete < 100).sort((a, b) => b.percentComplete - a.percentComplete);
  if (inProgress.length > 0) return inProgress[0];

  return scored[0];
}

export async function getCertificateProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string | null,
): Promise<CertificateProgress | null> {
  let curriculumIds: string[] | null = null;
  if (orgId) {
    const { data: selections } = await supabase
      .from("org_catalog_selections")
      .select("content_id")
      .eq("org_id", orgId)
      .eq("content_type", "curriculum");
    curriculumIds = (selections ?? []).map((s) => s.content_id);
    if (curriculumIds.length === 0) return null;
  }

  const baseQuery = supabase
    .from("curricula")
    .select("id, title, certificate_awarded, pass_threshold")
    .eq("status", "published")
    .eq("certificate_awarded", true)
    .order("title");

  const { data: curricula } = await (curriculumIds ? baseQuery.in("id", curriculumIds) : baseQuery);

  if (!curricula || curricula.length === 0) return null;

  const fetchedCurriculumIds = curricula.map((c) => c.id);
  const { data: links } = await supabase
    .from("curriculum_modules")
    .select("curriculum_id, module_id")
    .in("curriculum_id", fetchedCurriculumIds);

  const moduleIds = Array.from(new Set((links ?? []).map((l) => l.module_id)));
  const { data: attempts } =
    moduleIds.length > 0
      ? await supabase.from("quiz_attempts").select("module_id, score").eq("user_id", userId).in("module_id", moduleIds)
      : { data: [] };

  const bestByModule = new Map<string, number>();
  for (const a of attempts ?? []) {
    if (!a.module_id) continue;
    bestByModule.set(a.module_id, Math.max(bestByModule.get(a.module_id) ?? 0, a.score));
  }

  const input: CurriculumForProgress[] = curricula.map((c) => ({
    curriculumId: c.id,
    title: c.title,
    certificateAwarded: c.certificate_awarded,
    modules: (links ?? [])
      .filter((l) => l.curriculum_id === c.id)
      .map((l) => ({ bestScore: bestByModule.get(l.module_id) ?? null, passThreshold: c.pass_threshold })),
  }));

  return pickCertificateProgress(input);
}
