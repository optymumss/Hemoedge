import { getCurrentProfile } from "@/lib/auth/get-profile";

export default async function AdminHome() {
  const profile = await getCurrentProfile();
  const isSuperAdmin = profile?.role === "super_admin";

  return (
    <div>
      <h1 className="text-xl font-semibold">
        {isSuperAdmin ? "Super Admin" : "Content Manager"}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-neutral-600">
        {isSuperAdmin
          ? "Full platform control: content library, review queue, organizations, tiers, and the site CMS."
          : "Author and submit content for review — Library, Module, and Case Management. A Super Admin approves before anything reaches the published catalog."}
      </p>
    </div>
  );
}
