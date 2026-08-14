import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function GradingQueuePage() {
  const supabase = await createClient();
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("id, created_at, module_id, case_id, profiles(full_name, email), modules(title), cases(title)")
    .eq("pending_manual_grading", true)
    .order("created_at", { ascending: true });

  return (
    <div>
      <h1 className="text-xl font-semibold">Grading Queue</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Quiz attempts with short-answer responses waiting for a grade.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
            <tr>
              <th className="px-4 py-2">Learner</th>
              <th className="px-4 py-2">Content</th>
              <th className="px-4 py-2">Submitted</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(attempts ?? []).map((a) => (
              <tr key={a.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">
                  {a.profiles?.full_name || a.profiles?.email || "—"}
                </td>
                <td className="px-4 py-2 text-ink-dim">{a.modules?.title ?? a.cases?.title ?? "—"}</td>
                <td className="px-4 py-2 text-ink-dim">
                  {new Date(a.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/grading-queue/${a.id}`} className="text-xs text-ink-dim underline">
                    Grade
                  </Link>
                </td>
              </tr>
            ))}
            {(attempts ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
                  Nothing pending grading.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
