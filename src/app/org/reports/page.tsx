import { getCurrentOrg } from "@/lib/org/get-current-org";
import { getOrgProgress } from "@/lib/org/get-org-progress";
import { ComingSoon } from "@/components/coming-soon";

export default async function ReportsPage() {
  const org = await getCurrentOrg();
  if (!org) {
    return (
      <ComingSoon
        title="No organization assigned"
        description="This account isn't set as an owner/admin of any organization yet."
      />
    );
  }

  const { members } = await getOrgProgress(org.id);
  const attempted = members.filter((m) => m.attemptCount > 0).length;

  return (
    <div>
      <h1 className="text-xl font-semibold">Reports — {org.name}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Export completion and progress reports.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 p-4">
          <p className="text-xs uppercase text-neutral-400">Learners</p>
          <p className="mt-1 text-2xl font-semibold">{members.length}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4">
          <p className="text-xs uppercase text-neutral-400">Have attempted a quiz</p>
          <p className="mt-1 text-2xl font-semibold">{attempted}</p>
        </div>
      </div>

      <a
        href="/org/reports/export"
        className="mt-6 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
      >
        Download progress CSV
      </a>
    </div>
  );
}
