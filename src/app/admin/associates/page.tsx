import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { ComingSoon } from "@/components/coming-soon";
import { AssociateForm } from "./associate-form";

export default async function AssociatesPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") {
    return <ComingSoon title="Super Admin only" description="Associates are managed by HemoEdge staff." />;
  }

  const supabase = await createClient();
  const { data: associates } = await supabase
    .from("associates")
    .select("id, name, title, bio")
    .order("name");

  return (
    <div>
      <h1 className="text-xl font-semibold">Associates</h1>

      <div className="mt-6 rounded-lg border border-neutral-200 p-4">
        <AssociateForm />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(associates ?? []).map((a) => (
          <div key={a.id} className="rounded-lg border border-neutral-200 p-4">
            <h2 className="font-medium">{a.name}</h2>
            {a.title && <p className="text-xs text-neutral-500">{a.title}</p>}
            {a.bio && <p className="mt-2 text-sm text-neutral-600">{a.bio}</p>}
          </div>
        ))}
        {(associates ?? []).length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-neutral-400">
            No associates yet.
          </p>
        )}
      </div>
    </div>
  );
}
