import type { createClient } from "@/lib/supabase/server";

function generateVerificationCode(): string {
  return `HE-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now()
    .toString(36)
    .toUpperCase()}`;
}

/**
 * After a module quiz attempt, checks every curriculum that module belongs
 * to. If the learner's best score on every module in that curriculum now
 * meets the curriculum's pass threshold, issues a certificate (once).
 */
export async function checkAndIssueCertificates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  moduleId: string,
) {
  const { data: curriculumLinks } = await supabase
    .from("curriculum_modules")
    .select("curriculum_id")
    .eq("module_id", moduleId);

  for (const link of curriculumLinks ?? []) {
    const { data: curriculum } = await supabase
      .from("curricula")
      .select("id, pass_threshold")
      .eq("id", link.curriculum_id)
      .single();
    if (!curriculum) continue;

    const { data: stageModules } = await supabase
      .from("curriculum_modules")
      .select("module_id")
      .eq("curriculum_id", curriculum.id);

    const moduleIds = (stageModules ?? []).map((m) => m.module_id);
    if (moduleIds.length === 0) continue;

    const { data: attempts } = await supabase
      .from("quiz_attempts")
      .select("module_id, score")
      .eq("user_id", userId)
      .in("module_id", moduleIds);

    const bestByModule = new Map<string, number>();
    for (const a of attempts ?? []) {
      if (!a.module_id) continue;
      bestByModule.set(a.module_id, Math.max(bestByModule.get(a.module_id) ?? 0, a.score));
    }

    const allPassed = moduleIds.every(
      (id) => (bestByModule.get(id) ?? 0) >= curriculum.pass_threshold,
    );
    if (!allPassed) continue;

    const { data: existing } = await supabase
      .from("certificates")
      .select("id")
      .eq("user_id", userId)
      .eq("curriculum_id", curriculum.id)
      .maybeSingle();
    if (existing) continue;

    await supabase.from("certificates").insert({
      user_id: userId,
      curriculum_id: curriculum.id,
      verification_code: generateVerificationCode(),
    });
  }
}
