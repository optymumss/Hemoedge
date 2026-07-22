import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { SubmitForReviewButton } from "@/components/submit-for-review-button";
import { FeatureForm } from "./feature-form";

export default async function FeaturesPage() {
  const supabase = await createClient();
  const [{ data: features }, { data: cellTypes }] = await Promise.all([
    supabase
      .from("features")
      .select("id, title, definition, status, cell_type_id, cell_types(name)")
      .order("created_at", { ascending: false }),
    supabase.from("cell_types").select("id, name").order("name"),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold">Features</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Blood cell morphology reference entries with cropped image examples.
      </p>

      <div className="mt-6 rounded-lg border border-line p-4">
        <FeatureForm cellTypes={cellTypes ?? []} />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Cell Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(features ?? []).map((f) => (
              <tr key={f.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{f.title}</td>
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
                <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
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
