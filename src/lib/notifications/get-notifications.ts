import { createClient } from "@/lib/supabase/server";
import type { NotificationRow } from "./format-notifications";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type NotificationsResult = {
  notifications: NotificationRow[];
  lastViewedAt: string | null;
};

const EMPTY_RESULT: NotificationsResult = { notifications: [], lastViewedAt: null };

export async function getNotifications(supabase: SupabaseClient): Promise<NotificationsResult> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return EMPTY_RESULT;

    const [{ data: notifications, error: notificationsError }, { data: profile, error: profileError }] =
      await Promise.all([
        supabase
          .from("notifications")
          .select("id, kind, content_type, content_id, title, decision, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("profiles").select("notifications_last_viewed_at").eq("id", user.id).single(),
      ]);

    if (notificationsError || profileError) return EMPTY_RESULT;
    return {
      notifications: (notifications ?? []) as NotificationRow[],
      lastViewedAt: profile?.notifications_last_viewed_at ?? null,
    };
  } catch {
    return EMPTY_RESULT;
  }
}
