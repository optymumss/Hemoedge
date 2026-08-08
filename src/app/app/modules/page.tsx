import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId } from "@/lib/auth/impersonation";
import { getLearnerOrgId } from "@/lib/learner/get-learner-org";
import { getPublishedContent } from "@/lib/learner/published-content";

export default async function LearnerModulesPage() {
  const orgId = await getLearnerOrgId();
  const userId = await getEffectiveUserId();
  const modules = await getPublishedContent("modules", "module", orgId);

  const supabase = await createClient();
  const moduleIds = modules.map((m) => m.id);
  const { data: attempts } =
    moduleIds.length > 0
      ? await supabase
          .from("quiz_attempts")
          .select("module_id, passed")
          .eq("user_id", userId!)
          .in("module_id", moduleIds)
      : { data: [] };

  const passedIds = new Set((attempts ?? []).filter((a) => a.passed).map((a) => a.module_id));
  const attemptedIds = new Set((attempts ?? []).map((a) => a.module_id));

  return (
    <div>
      <h1 className="text-xl font-semibold">Modules</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Learn by cell line or by syndrome/case.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Link
            key={m.id}
            href={`/app/modules/${m.id}`}
            className="rounded-lg border border-line p-4 hover:border-line-strong"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs uppercase text-ink-faint">{m.level}</span>
              {passedIds.has(m.id) ? (
                <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success-soft-ink">
                  Passed
                </span>
              ) : attemptedIds.has(m.id) ? (
                <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-dim">
                  In progress
                </span>
              ) : null}
            </div>
            <h2 className="mt-1 font-medium">{m.title}</h2>
          </Link>
        ))}
        {modules.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-ink-faint">
            No modules assigned yet.
          </p>
        )}
      </div>
    </div>
  );
}
