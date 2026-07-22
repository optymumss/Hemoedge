import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { SubmitForReviewButton } from "@/components/submit-for-review-button";
import { UploadForm } from "./upload-form";
import { ViewSlideButton } from "./view-slide-button";

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

export default async function SlidesPage() {
  const supabase = await createClient();
  const { data: slides } = await supabase
    .from("slides")
    .select("id, title, size_bytes, status, slide_categories(name)")
    .order("created_at", { ascending: false });

  const { data: categories } = await supabase
    .from("slide_categories")
    .select("id, name")
    .order("name");

  return (
    <div>
      <h1 className="text-xl font-semibold">Slides</h1>
      <p className="mt-1 text-sm text-ink-dim">
        The WSI slide bank — upload files here, then reference them from modules and cases.
      </p>

      <div className="mt-6 rounded-lg border border-line p-4">
        <UploadForm categories={categories ?? []} />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Size</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(slides ?? []).map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{s.title}</td>
                <td className="px-4 py-2 text-ink-dim">
                  {s.slide_categories?.name ?? "—"}
                </td>
                <td className="px-4 py-2 text-ink-dim">{formatSize(s.size_bytes)}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <ViewSlideButton slideId={s.id} title={s.title} />
                    {(s.status === "draft" || s.status === "changes_requested") && (
                      <SubmitForReviewButton
                        contentType="slide"
                        id={s.id}
                        path="/admin/slides"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(slides ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-faint">
                  No slides yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
