import { getLearnerOrgId } from "@/lib/learner/get-learner-org";
import { getPublishedContent } from "@/lib/learner/published-content";

export default async function LearnerModulesPage() {
  const orgId = await getLearnerOrgId();
  const modules = await getPublishedContent("modules", "module", orgId);

  return (
    <div>
      <h1 className="text-xl font-semibold">Modules</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Learn by cell line or by syndrome/case.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <div key={m.id} className="rounded-lg border border-neutral-200 p-4">
            <span className="text-xs uppercase text-neutral-400">{m.level}</span>
            <h2 className="mt-1 font-medium">{m.title}</h2>
          </div>
        ))}
        {modules.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-neutral-400">
            No modules assigned yet.
          </p>
        )}
      </div>
    </div>
  );
}
