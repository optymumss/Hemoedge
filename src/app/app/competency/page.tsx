import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLearnerOrgId } from "@/lib/learner/get-learner-org";

export default async function CompetencyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgId = await getLearnerOrgId();

  let curriculumIds: string[] | null = null;
  if (orgId) {
    const { data: selections } = await supabase
      .from("org_catalog_selections")
      .select("content_id")
      .eq("org_id", orgId)
      .eq("content_type", "curriculum");
    curriculumIds = (selections ?? []).map((s) => s.content_id);
  }

  let query = supabase
    .from("curricula")
    .select("id, title, level, pass_threshold")
    .eq("status", "published")
    .order("level");
  if (curriculumIds !== null) {
    query = query.in("id", curriculumIds.length > 0 ? curriculumIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data: curricula } = await query;

  const { data: certificates } = await supabase
    .from("certificates")
    .select("curriculum_id")
    .eq("user_id", user!.id);
  const certifiedIds = new Set((certificates ?? []).map((c) => c.curriculum_id));

  const stages = await Promise.all(
    (curricula ?? []).map(async (curriculum) => {
      const { data: links } = await supabase
        .from("curriculum_modules")
        .select("module_id, modules(id, title)")
        .eq("curriculum_id", curriculum.id)
        .order("position");

      const moduleIds = (links ?? []).map((l) => l.module_id);
      const { data: attempts } =
        moduleIds.length > 0
          ? await supabase
              .from("quiz_attempts")
              .select("module_id, score")
              .eq("user_id", user!.id)
              .in("module_id", moduleIds)
          : { data: [] };

      const bestByModule = new Map<string, number>();
      for (const a of attempts ?? []) {
        bestByModule.set(a.module_id, Math.max(bestByModule.get(a.module_id) ?? 0, a.score));
      }

      const modules = (links ?? []).map((l) => ({
        id: l.module_id,
        title: l.modules?.title ?? "Untitled module",
        bestScore: bestByModule.get(l.module_id) ?? null,
      }));

      const completed =
        modules.length > 0 &&
        modules.every((m) => (m.bestScore ?? 0) >= curriculum.pass_threshold);

      return { curriculum, modules, completed };
    }),
  );

  return (
    <div>
      <h1 className="text-xl font-semibold">Competency Pathway</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Complete every module in a stage at or above its pass threshold to earn a certificate.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        {stages.map(({ curriculum, modules, completed }) => (
          <div key={curriculum.id} className="rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase text-neutral-400">{curriculum.level}</span>
                <h2 className="font-medium">{curriculum.title}</h2>
              </div>
              {certifiedIds.has(curriculum.id) ? (
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  Certified
                </span>
              ) : completed ? (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Complete
                </span>
              ) : (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                  In progress
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Pass threshold: {curriculum.pass_threshold}%
            </p>
            <ul className="mt-3 flex flex-col gap-1">
              {modules.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <Link href={`/app/modules/${m.id}`} className="hover:underline">
                    {m.title}
                  </Link>
                  <span
                    className={
                      m.bestScore === null
                        ? "text-neutral-400"
                        : m.bestScore >= curriculum.pass_threshold
                          ? "text-green-700"
                          : "text-amber-700"
                    }
                  >
                    {m.bestScore === null ? "Not attempted" : `${m.bestScore}%`}
                  </span>
                </li>
              ))}
              {modules.length === 0 && (
                <li className="text-sm text-neutral-400">No modules linked to this stage yet.</li>
              )}
            </ul>
          </div>
        ))}
        {stages.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-400">
            No curricula assigned yet.
          </p>
        )}
      </div>
    </div>
  );
}
