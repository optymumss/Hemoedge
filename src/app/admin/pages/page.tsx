import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { ComingSoon } from "@/components/coming-soon";
import { PageForm } from "./page-form";
import { togglePageStatus } from "./actions";

export default async function PagesPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") {
    return <ComingSoon title="Super Admin only" description="Marketing pages are managed by HemoEdge staff." />;
  }

  const supabase = await createClient();
  const { data: pages } = await supabase
    .from("pages")
    .select("id, title, type, status")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-semibold">Pages</h1>
      <p className="mt-1 text-sm text-neutral-500">Marketing site pages.</p>

      <div className="mt-6 rounded-lg border border-neutral-200 p-4">
        <PageForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(pages ?? []).map((p) => (
              <tr key={p.id} className="border-t border-neutral-200">
                <td className="px-4 py-2 font-medium">{p.title}</td>
                <td className="px-4 py-2 capitalize text-neutral-500">{p.type}</td>
                <td className="px-4 py-2 capitalize text-neutral-500">{p.status}</td>
                <td className="px-4 py-2 text-right">
                  <form action={togglePageStatus}>
                    <input type="hidden" name="id" value={p.id} />
                    <input
                      type="hidden"
                      name="next_status"
                      value={p.status === "published" ? "draft" : "published"}
                    />
                    <button type="submit" className="text-xs text-blue-700 underline">
                      {p.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(pages ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                  No pages yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
