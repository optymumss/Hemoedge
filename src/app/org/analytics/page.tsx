import { getCurrentOrg } from "@/lib/org/get-current-org";
import { getOrgProgress } from "@/lib/org/get-org-progress";
import { ComingSoon } from "@/components/coming-soon";

export default async function AnalyticsPage() {
  const org = await getCurrentOrg();
  if (!org) {
    return (
      <ComingSoon
        title="No organization assigned"
        description="This account isn't set as an owner/admin of any organization yet."
      />
    );
  }

  const { members, modules } = await getOrgProgress(org.id);
  const weakest = modules.slice(0, 5);

  return (
    <div>
      <h1 className="text-xl font-semibold">Analytics — {org.name}</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Team scores and weak areas across your learners.
      </p>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-ink">Weakest modules</h2>
        <div className="mt-2 overflow-hidden rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
              <tr>
                <th className="px-4 py-2">Module</th>
                <th className="px-4 py-2">Attempts</th>
                <th className="px-4 py-2">Average Score</th>
              </tr>
            </thead>
            <tbody>
              {weakest.map((m) => (
                <tr key={m.moduleId} className="border-t border-line">
                  <td className="px-4 py-2 font-medium">{m.title}</td>
                  <td className="px-4 py-2 text-ink-dim">{m.attemptCount}</td>
                  <td
                    className={`px-4 py-2 ${m.averageScore < 70 ? "text-warning-soft-ink" : "text-ink-dim"}`}
                  >
                    {m.averageScore}%
                  </td>
                </tr>
              ))}
              {weakest.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-ink-faint">
                    No quiz attempts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-ink">Learners</h2>
        <div className="mt-2 overflow-hidden rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Attempts</th>
                <th className="px-4 py-2">Average Score</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className="border-t border-line">
                  <td className="px-4 py-2 font-medium">{m.name}</td>
                  <td className="px-4 py-2 text-ink-dim">{m.attemptCount}</td>
                  <td className="px-4 py-2 text-ink-dim">
                    {m.averageScore === null ? "—" : `${m.averageScore}%`}
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-ink-faint">
                    No learners yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
