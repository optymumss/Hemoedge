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
      <p className="mt-1 text-sm text-neutral-500">
        Real-world clinical scenarios with ordered slides and case questions.
      </p>

      <div className="mt-6 rounded-lg border border-neutral-200 p-4">
        <CaseForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Level</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(cases ?? []).map((c) => (
              <tr key={c.id} className="border-t border-neutral-200">
                <td className="px-4 py-2 font-medium">{c.title}</td>
                <td className="px-4 py-2 capitalize text-neutral-500">{c.level}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  {(c.status === "draft" || c.status === "changes_requested") && (
                    <SubmitForReviewButton
                      contentType="case"
                      id={c.id}
                      path="/admin/cases"
                    />
                  )}
                </td>
              </tr>
            ))}
            {(cases ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
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
