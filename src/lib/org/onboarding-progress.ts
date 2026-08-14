import type { createClient } from "@/lib/supabase/server";

export type PlanItemProgress = {
  itemId: string;
  label: string;
  kind: "module" | "pathway";
  done: boolean;
  fraction?: string;
};

type PlanItem = {
  id: string;
  module_id: string | null;
  curriculum_id: string | null;
  modules: { title: string } | null;
  curricula: { title: string } | null;
};

/**
 * Derives per-item completion from existing quiz_attempts / curriculum_modules
 * data rather than tracking onboarding progress separately. A module item is
 * done once the learner has a passing attempt; a pathway item's completion
 * is the fraction of its modules they've passed.
 */
export async function computeAssigneeProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  items: PlanItem[],
): Promise<PlanItemProgress[]> {
  const results: PlanItemProgress[] = [];

  for (const item of items) {
    if (item.module_id) {
      const { data: attempts } = await supabase
        .from("quiz_attempts")
        .select("passed")
        .eq("user_id", userId)
        .eq("module_id", item.module_id);
      results.push({
        itemId: item.id,
        label: item.modules?.title ?? "—",
        kind: "module",
        done: (attempts ?? []).some((a) => a.passed),
      });
    } else if (item.curriculum_id) {
      const { data: modules } = await supabase
        .from("curriculum_modules")
        .select("module_id")
        .eq("curriculum_id", item.curriculum_id);
      const moduleIds = (modules ?? []).map((m) => m.module_id);

      let passedCount = 0;
      if (moduleIds.length > 0) {
        const { data: attempts } = await supabase
          .from("quiz_attempts")
          .select("module_id, passed")
          .eq("user_id", userId)
          .in("module_id", moduleIds);
        passedCount = new Set((attempts ?? []).filter((a) => a.passed).map((a) => a.module_id)).size;
      }

      results.push({
        itemId: item.id,
        label: item.curricula?.title ?? "—",
        kind: "pathway",
        done: moduleIds.length > 0 && passedCount === moduleIds.length,
        fraction: `${passedCount}/${moduleIds.length}`,
      });
    }
  }

  return results;
}
