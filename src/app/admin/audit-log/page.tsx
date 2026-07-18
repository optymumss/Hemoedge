import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { ComingSoon } from "@/components/coming-soon";

function formatMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "";
  const entries = Object.entries(metadata as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
}

export default async function AuditLogPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") {
    return (
      <ComingSoon
        title="Super Admin only"
        description="The audit log is visible to HemoEdge staff."
      />
    );
  }

  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("audit_log")
    .select("id, action, target_type, target_id, metadata, created_at, profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 className="text-xl font-semibold">Audit Log</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Role changes, content review decisions, and organization changes — most recent 200.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map((e) => (
              <tr key={e.id} className="border-t border-neutral-200">
                <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 font-medium">
                  {e.profiles?.full_name || e.profiles?.email || "—"}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-neutral-600">{e.action}</td>
                <td className="px-4 py-2 text-neutral-500">
                  {e.target_type}
                  {e.target_id ? ` · ${e.target_id.slice(0, 8)}` : ""}
                </td>
                <td className="px-4 py-2 text-xs text-neutral-500">
                  {formatMetadata(e.metadata)}
                </td>
              </tr>
            ))}
            {(entries ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                  No activity recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
