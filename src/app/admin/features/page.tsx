import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { SubmitForReviewButton } from "@/components/submit-for-review-button";

export default async function FeaturesPage() {
  const supabase = await createClient();
  const { data: features } = await supabase
    .from("features")
    .select("id, title, definition, status, cell_type_id, image_path, cell_types(name)")
    .order("created_at", { ascending: false });

  const imageUrls = new Map(
    await Promise.all(
      (features ?? [])
        .filter((f) => f.image_path)
        .map(async (f) => {
          const { data } = await supabase.storage
            .from("feature-images")
            .createSignedUrl(f.image_path!, 60 * 10);
          return [f.id, data?.signedUrl ?? null] as const;
        }),
    ),
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Features</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Blood cell morphology reference entries with cropped image examples.
          </p>
        </div>
        <Link
          href="/admin/features/new"
          className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink"
        >
          + New
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
            <tr>
              <th className="px-4 py-2">Image</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Cell Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(features ?? []).map((f) => (
              <tr key={f.id} className="border-t border-line">
                <td className="px-4 py-2">
                  {imageUrls.get(f.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrls.get(f.id)!}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
                <td className="px-4 py-2 font-medium">
                  <Link href={`/admin/features/${f.id}`} className="hover:underline">
                    {f.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-ink-dim">
                  {f.cell_types?.name ?? "—"}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={f.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  {(f.status === "draft" || f.status === "changes_requested") && (
                    <SubmitForReviewButton
                      contentType="feature"
                      id={f.id}
                      path="/admin/features"
                    />
                  )}
                </td>
              </tr>
            ))}
            {(features ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-faint">
                  No features yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
