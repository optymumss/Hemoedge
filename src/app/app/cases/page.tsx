import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId } from "@/lib/auth/impersonation";
import { getLearnerOrgId } from "@/lib/learner/get-learner-org";
import { getPublishedContent } from "@/lib/learner/published-content";

export default async function LearnerCasesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const orgId = await getLearnerOrgId();
  const userId = await getEffectiveUserId();
  const cases = await getPublishedContent("cases", "case", orgId);

  const supabase = await createClient();
  const caseIds = cases.map((c) => c.id);
  const [{ data: attempts }, { data: categoryRows }] =
    caseIds.length > 0
      ? await Promise.all([
          supabase.from("quiz_attempts").select("case_id, passed").eq("user_id", userId!).in("case_id", caseIds),
          supabase.from("cases").select("id, case_category").in("id", caseIds),
        ])
      : [{ data: [] }, { data: [] }];

  const passedIds = new Set((attempts ?? []).filter((a) => a.passed).map((a) => a.case_id));
  const attemptedIds = new Set((attempts ?? []).map((a) => a.case_id));
  const categoryById = new Map((categoryRows ?? []).map((c) => [c.id, c.case_category]));
  const casesWithCategory = cases.map((c) => ({ ...c, case_category: categoryById.get(c.id) ?? null }));

  const categories = Array.from(
    new Set(casesWithCategory.map((c) => c.case_category).filter((c): c is string => Boolean(c))),
  ).sort();
  const activeCategory = category && categories.includes(category) ? category : null;
  const filtered = activeCategory
    ? casesWithCategory.filter((c) => c.case_category === activeCategory)
    : casesWithCategory;

  return (
    <div>
      <h1 className="text-xl font-semibold">Case Studies</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Real-world haematology cases for clinical learning.
      </p>

      {categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1 rounded-md border border-line-strong bg-surface-sunken p-1" role="group" aria-label="Browse by category">
          <Link
            href="/app/cases"
            className={`rounded px-2.5 py-1 text-xs font-medium ${
              !activeCategory ? "bg-accent text-accent-ink" : "text-ink-dim hover:bg-surface-raised"
            }`}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/app/cases?category=${encodeURIComponent(cat)}`}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                activeCategory === cat ? "bg-accent text-accent-ink" : "text-ink-dim hover:bg-surface-raised"
              }`}
            >
              {cat}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/app/cases/${c.id}`}
            className="rounded-lg border border-line p-4 hover:border-line-strong"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs uppercase text-ink-faint">{c.level}</span>
              {passedIds.has(c.id) ? (
                <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success-soft-ink">
                  Passed
                </span>
              ) : attemptedIds.has(c.id) ? (
                <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-dim">
                  In progress
                </span>
              ) : null}
            </div>
            <h2 className="mt-1 font-medium">{c.title}</h2>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-ink-faint">
            {activeCategory ? "No cases in this category yet." : "No cases assigned yet."}
          </p>
        )}
      </div>
    </div>
  );
}
