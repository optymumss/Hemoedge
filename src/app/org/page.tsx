import { getCurrentOrg } from "@/lib/org/get-current-org";

export default async function OrgHome() {
  const org = await getCurrentOrg();

  return (
    <div>
      <h1 className="text-xl font-semibold">
        {org ? org.name : "Org Admin"}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-ink-dim">
        {org
          ? "Manage your roster, choose what your learners study from the published catalog, and track team progress."
          : "This account isn't set as an owner/admin of any organization yet."}
      </p>
    </div>
  );
}
