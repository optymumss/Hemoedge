import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getPlatformOrgSummary } from "@/lib/admin/get-platform-summary";

export default async function AdminHome() {
  const profile = await getCurrentProfile();
  const isSuperAdmin = profile?.role === "super_admin";

  if (!isSuperAdmin) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Content Manager</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-dim">
          Author and submit content for review — Library, Module, and Case Management. A Super Admin approves before
          anything reaches the published catalog.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const summary = await getPlatformOrgSummary(supabase);

  return (
    <div>
      <h1 className="text-xl font-semibold">Super Admin</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-dim">
        Full platform control: content library, review queue, organizations, tiers, and the site CMS.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-line border-l-4 border-l-accent p-4">
          <p className="text-xs uppercase text-ink-faint">Organizations</p>
          <p className="mt-1 text-2xl font-semibold">{summary.totalOrgs}</p>
          <p className="mt-1 text-xs text-ink-dim">
            {summary.activeOrgs} active &middot; {summary.suspendedOrgs} suspended
          </p>
        </div>
        <div className="rounded-lg border border-line border-l-4 border-l-accent p-4">
          <p className="text-xs uppercase text-ink-faint">Learners</p>
          <p className="mt-1 text-2xl font-semibold">{summary.totalLearners}</p>
        </div>
        <div className="rounded-lg border border-line border-l-4 border-l-accent p-4">
          <p className="text-xs uppercase text-ink-faint">Near/At Seat Limit</p>
          <p className="mt-1 text-2xl font-semibold">{summary.nearSeatLimitCount}</p>
        </div>
        <div className="rounded-lg border border-line border-l-4 border-l-accent p-4">
          <p className="text-xs uppercase text-ink-faint">New (Last 30 Days)</p>
          <p className="mt-1 text-2xl font-semibold">{summary.newLast30Days}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Near/At Seat Limit</h2>
            <Link href="/admin/organizations" className="text-xs font-medium text-accent">
              View all &rarr;
            </Link>
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
                <tr>
                  <th className="px-4 py-2">Organization</th>
                  <th className="px-4 py-2">Seats</th>
                  <th className="px-4 py-2">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {summary.nearSeatLimit.map((org) => (
                  <tr key={org.orgId} className="border-t border-line">
                    <td className="px-4 py-2 font-medium">{org.name}</td>
                    <td className="px-4 py-2 text-ink-dim">
                      {org.memberCount} / {org.seats}
                    </td>
                    <td className="px-4 py-2 text-ink-dim">{org.utilizationPercent}%</td>
                  </tr>
                ))}
                {summary.nearSeatLimit.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-ink-faint">
                      No organizations near their seat limit.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Recently Created Organizations</h2>
            <Link href="/admin/organizations" className="text-xs font-medium text-accent">
              View all &rarr;
            </Link>
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
                <tr>
                  <th className="px-4 py-2">Organization</th>
                  <th className="px-4 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentlyCreated.map((org) => (
                  <tr key={org.orgId} className="border-t border-line">
                    <td className="px-4 py-2 font-medium">{org.name}</td>
                    <td className="px-4 py-2 text-ink-dim">{new Date(org.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {summary.recentlyCreated.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-ink-faint">
                      No organizations yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
