import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { StatusBadge } from "@/components/status-badge";
import { SubmitForReviewButton } from "@/components/submit-for-review-button";
import { UploadForm } from "./upload-form";
import { ViewSlideButton } from "./view-slide-button";
import { DeleteSlideButton } from "./delete-slide-button";
import { retryTiling } from "./actions";

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

const TILING_STATUS: Record<string, { label: string; className: string }> = {
  none: { label: "Not tiled", className: "bg-surface-sunken text-ink-faint" },
  queued: { label: "Queued", className: "bg-warning-soft text-warning-soft-ink" },
  processing: { label: "Processing", className: "bg-warning-soft text-warning-soft-ink" },
  ready: { label: "Tiled", className: "bg-success-soft text-success-soft-ink" },
  failed: { label: "Tiling failed", className: "bg-danger-soft text-danger-soft-ink" },
};

export default async function SlidesPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const { data: slides } = await supabase
    .from("slides")
    .select("id, title, size_bytes, status, tiling_status, created_by, slide_categories(name)")
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
              <th className="px-4 py-2">Tiling</th>
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
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      (TILING_STATUS[s.tiling_status] ?? TILING_STATUS.none).className
                    }`}
                  >
                    {(TILING_STATUS[s.tiling_status] ?? TILING_STATUS.none).label}
                  </span>
                  {s.tiling_status === "failed" && (
                    <form action={retryTiling} className="mt-1">
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="text-xs text-ink-dim underline">
                        Retry
                      </button>
                    </form>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <ViewSlideButton slideId={s.id} title={s.title} />
                    <Link href={`/admin/slides/${s.id}/annotations`} className="text-xs text-ink-dim underline">
                      Annotate
                    </Link>
                    {(s.status === "draft" || s.status === "changes_requested") && (
                      <SubmitForReviewButton
                        contentType="slide"
                        id={s.id}
                        path="/admin/slides"
                      />
                    )}
                    {profile &&
                      (profile.role === "super_admin" ||
                        (profile.role === "content_manager" &&
                          s.created_by === profile.id &&
                          (s.status === "draft" || s.status === "changes_requested"))) && (
                        <DeleteSlideButton id={s.id} title={s.title} />
                      )}
                  </div>
                </td>
              </tr>
            ))}
            {(slides ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-faint">
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
