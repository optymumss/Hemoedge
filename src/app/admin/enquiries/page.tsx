import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { ComingSoon } from "@/components/coming-soon";

export default async function EnquiriesPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") {
    return <ComingSoon title="Super Admin only" description="Enquiries are managed by HemoEdge staff." />;
  }

  const supabase = await createClient();
  const { data: enquiries } = await supabase
    .from("enquiries")
    .select("id, name, email, message, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-semibold">Enquiries</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Submissions from the public contact form.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {(enquiries ?? []).map((e) => (
          <div key={e.id} className="rounded-lg border border-neutral-200 p-4">
            <div className="flex items-baseline justify-between">
              <p className="font-medium">
                {e.name} <span className="font-normal text-neutral-500">— {e.email}</span>
              </p>
              <p className="text-xs text-neutral-400">
                {new Date(e.created_at).toLocaleDateString()}
              </p>
            </div>
            <p className="mt-2 text-sm text-neutral-600">{e.message}</p>
          </div>
        ))}
        {(enquiries ?? []).length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-400">
            No enquiries yet — the public contact form isn&apos;t built yet either.
          </p>
        )}
      </div>
    </div>
  );
}
