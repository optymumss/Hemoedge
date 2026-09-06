import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { SubmitForReviewButton } from "@/components/submit-for-review-button";
import { ExerciseForm } from "./exercise-form";

export default async function CellIdPage() {
  const supabase = await createClient();
  const [{ data: exercises }, { data: slides }] = await Promise.all([
    supabase
      .from("cell_id_exercises")
      .select("id, title, level, status, slides(title)")
      .order("created_at", { ascending: false }),
    supabase.from("slides").select("id, title").order("title"),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold">Cell Identification</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Spatial identification exercises: learners click through a curated set of pins on a
        slide and identify each cell, scored against your ground truth. Separate from the
        Manual Diff Counter — this is for recognizing selected cells or abnormal features, not
        differential counting practice.
      </p>

      <div className="mt-6 rounded-lg border border-line p-4">
        <ExerciseForm slides={slides ?? []} />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Slide</th>
              <th className="px-4 py-2">Level</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(exercises ?? []).map((e) => (
              <tr key={e.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/admin/cell-id/${e.id}`} className="hover:underline">
                    {e.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-ink-dim">{e.slides?.title ?? "—"}</td>
                <td className="px-4 py-2 capitalize text-ink-dim">{e.level}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={e.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  {(e.status === "draft" || e.status === "changes_requested") && (
                    <SubmitForReviewButton
                      contentType="cell_id_exercise"
                      id={e.id}
                      path="/admin/cell-id"
                    />
                  )}
                </td>
              </tr>
            ))}
            {(exercises ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-faint">
                  No exercises yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
