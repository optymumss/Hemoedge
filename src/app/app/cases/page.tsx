import Link from "next/link";
import { getLearnerOrgId } from "@/lib/learner/get-learner-org";
import { getPublishedContent } from "@/lib/learner/published-content";

export default async function LearnerCasesPage() {
  const orgId = await getLearnerOrgId();
  const cases = await getPublishedContent("cases", "case", orgId);

  return (
    <div>
      <h1 className="text-xl font-semibold">Cases</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Real-world haematology cases for clinical learning.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cases.map((c) => (
          <Link
            key={c.id}
            href={`/app/cases/${c.id}`}
            className="rounded-lg border border-line p-4 hover:border-line-strong"
          >
            <span className="text-xs uppercase text-ink-faint">{c.level}</span>
            <h2 className="mt-1 font-medium">{c.title}</h2>
          </Link>
        ))}
        {cases.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-ink-faint">
            No cases assigned yet.
          </p>
        )}
      </div>
    </div>
  );
}
