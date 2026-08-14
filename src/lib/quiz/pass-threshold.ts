import type { createClient } from "@/lib/supabase/server";

const DEFAULT_PASS_THRESHOLD = 70;

/**
 * A module can belong to zero, one, or several curricula, each with its own
 * pass_threshold — there's no single "correct" threshold in the ambiguous
 * cases, so this only applies a curriculum's threshold when the module
 * belongs to exactly one; otherwise it falls back to the platform default.
 * Certificate issuance (checkAndIssueCertificates) separately re-checks the
 * raw score against each linked curriculum's own threshold, so that part
 * already accounts for multi-curriculum membership correctly regardless of
 * what's stored here.
 */
export async function getModulePassThreshold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  moduleId: string,
): Promise<number> {
  const { data: links } = await supabase
    .from("curriculum_modules")
    .select("curriculum_id")
    .eq("module_id", moduleId);

  if (!links || links.length !== 1) return DEFAULT_PASS_THRESHOLD;

  const { data: curriculum } = await supabase
    .from("curricula")
    .select("pass_threshold")
    .eq("id", links[0].curriculum_id)
    .single();

  return curriculum?.pass_threshold ?? DEFAULT_PASS_THRESHOLD;
}

export const CASE_PASS_THRESHOLD = DEFAULT_PASS_THRESHOLD;
