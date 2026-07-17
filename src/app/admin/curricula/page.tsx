import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { SubmitForReviewButton } from "@/components/submit-for-review-button";
import { CurriculumForm } from "./curriculum-form";

export default async function CurriculaPage() {
  const supabase = await createClient();
  const { data: curricula } = await supabase
    .from("curricula")
    .select("id, title, level, pass_threshold, status")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-semibold">Curricula</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Versioned sets of modules that lead to a certificate.
      </p>

      <div className="mt-6 rounded-lg border border-neutral-200 p-4">
        <CurriculumForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Level</th>
              <th className="px-4 py-2">Pass Threshold</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(curricula ?? []).map((c) => (
              <tr key={c.id} className="border-t border-neutral-200">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/admin/curricula/${c.id}`} className="hover:underline">
                    {c.title}
                  </Link>
                </td>
                <td className="px-4 py-2 capitalize text-neutral-500">{c.level}</td>
                <td className="px-4 py-2 text-neutral-500">{c.pass_threshold}%</td>
                <td className="px-4 py-2">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  {(c.status === "draft" || c.status === "changes_requested") && (
                    <SubmitForReviewButton
                      contentType="curriculum"
                      id={c.id}
                      path="/admin/curricula"
                    />
                  )}
                </td>
              </tr>
            ))}
            {(curricula ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                  No curricula yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
