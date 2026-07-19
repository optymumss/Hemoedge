import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { SubmitForReviewButton } from "@/components/submit-for-review-button";
import { CaseForm } from "./case-form";

export default async function CasesPage() {
  const supabase = await createClient();
  const { data: cases } = await supabase
    .from("cases")
    .select("id, title, level, status")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-semibold">Cases</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Real-world clinical scenarios with ordered slides and case questions.
      </p>

      <div className="mt-6 rounded-lg border border-line p-4">
        <CaseForm />
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
                  No cases yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
