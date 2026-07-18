import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

/** Best-effort: an audit-log failure should never block the action it's recording. */
export async function logAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, Json> = {},
) {
  await supabase.from("audit_log").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
}
