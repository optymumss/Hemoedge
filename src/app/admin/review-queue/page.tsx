import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { CONTENT_TABLES, type ContentType } from "@/lib/content/types";
import { ReviewForm } from "./review-form";

export default async function ReviewQueuePage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isSuperAdmin = profile?.role === "super_admin";

  const { data: pending } = await supabase
    .from("content_reviews")
    .select("id, content_type, content_id, submitted_at, submitted_by, profiles!content_reviews_submitted_by_fkey(full_name, email)")
    .is("decision", null)
    .order("submitted_at", { ascending: true });

  const rows = await Promise.all(
    (pending ?? []).map(async (row) => {
      const table = CONTENT_TABLES[row.content_type as ContentType];
      const { data: content } = await supabase
        .from(table)
        .select("title")
        .eq("id", row.content_id)
        .single();
      return { ...row, title: content?.title ?? "(deleted)" };
    }),
  );

  return (
    <div>
      <h1 className="text-xl font-semibold">
        {isSuperAdmin ? "Review Queue" : "My Submissions"}
      </h1>
      <p className="mt-1 text-sm text-ink-dim">
        {isSuperAdmin
          ? "Content Manager submissions awaiting approval before they publish."
          : "Content you've submitted for review, awaiting a Super Admin's decision."}
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Submitted by</th>
              {isSuperAdmin && <th className="px-4 py-2">Decision</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="px-4 py-2 font-medium">{r.title}</td>
                <td className="px-4 py-2 capitalize text-ink-dim">
                  {r.content_type}
                </td>
                <td className="px-4 py-2 text-ink-dim">
                  {r.profiles?.full_name || r.profiles?.email}
                </td>
                {isSuperAdmin && (
                  <td className="px-4 py-2">
                    <ReviewForm
                      contentType={r.content_type as ContentType}
                      id={r.content_id}
                    />
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={isSuperAdmin ? 4 : 3}
                  className="px-4 py-6 text-center text-ink-faint"
                >
                  Nothing waiting on review.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
