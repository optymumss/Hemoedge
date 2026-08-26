import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { SubmitForReviewButton } from "@/components/submit-for-review-button";

export default async function CasesPage() {
  const supabase = await createClient();
  const { data: cases } = await supabase
    .from("cases")
    .select("id, title, level, status")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Case Studies</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Real-world clinical scenarios built around a WSI slide, with case context, lab values, and a knowledge check.
          </p>
        </div>
        <Link
          href="/admin/cases/new"
          className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink"
        >
          + New
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Level</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(cases ?? []).map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{c.title}</td>
                <td className="px-4 py-2 capitalize text-ink-dim">{c.level}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/admin/cases/${c.id}`} className="text-xs text-ink-dim underline">
                      View
                    </Link>
                    <Link href={`/admin/cases/${c.id}/quiz`} className="text-xs text-ink-dim underline">
                      Manage quiz
                    </Link>
                    {(c.status === "draft" || c.status === "changes_requested") && (
                      <SubmitForReviewButton
                        contentType="case"
                        id={c.id}
                        path="/admin/cases"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(cases ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
                  No case studies yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
