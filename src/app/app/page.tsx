import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getActiveImpersonation } from "@/lib/auth/impersonation";
import { getLearnerOrgId } from "@/lib/learner/get-learner-org";
import { getPublishedContent } from "@/lib/learner/published-content";

export default async function LearnerHome() {
  const profile = await getCurrentProfile();
  const impersonation = await getActiveImpersonation();
  const displayName = impersonation
    ? impersonation.target.fullName || impersonation.target.email
    : profile?.fullName || profile?.email;
  const orgId = await getLearnerOrgId();
  const [modules, cases] = await Promise.all([
    getPublishedContent("modules", "module", orgId),
    getPublishedContent("cases", "case", orgId),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold">
        Welcome, {displayName}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-neutral-600">
        {orgId
          ? "Here's what your organization has assigned."
          : "Here's what's available to study."}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 p-4">
          <p className="text-xs uppercase text-neutral-400">Modules available</p>
          <p className="mt-1 text-2xl font-semibold">{modules.length}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4">
          <p className="text-xs uppercase text-neutral-400">Cases available</p>
          <p className="mt-1 text-2xl font-semibold">{cases.length}</p>
        </div>
      </div>
    </div>
  );
}
