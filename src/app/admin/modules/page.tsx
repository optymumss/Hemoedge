import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { SubmitForReviewButton } from "@/components/submit-for-review-button";
import { ModuleForm } from "./module-form";

export default async function ModulesPage() {
  const supabase = await createClient();
  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, level, status")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-semibold">Modules</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Teaching units — each module contains ordered slides with a knowledge check.
      </p>

      <div className="mt-6 rounded-lg border border-line p-4">
        <ModuleForm />
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
            {(modules ?? []).map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{m.title}</td>
                <td className="px-4 py-2 capitalize text-ink-dim">{m.level}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={m.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/admin/modules/${m.id}/lessons`} className="text-xs text-ink-dim underline">
                      Manage lessons
                    </Link>
                    <Link href={`/admin/modules/${m.id}`} className="text-xs text-ink-dim underline">
                      Manage quiz
                    </Link>
                    {(m.status === "draft" || m.status === "changes_requested") && (
                      <SubmitForReviewButton
                        contentType="module"
                        id={m.id}
                        path="/admin/modules"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(modules ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
                  No modules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
