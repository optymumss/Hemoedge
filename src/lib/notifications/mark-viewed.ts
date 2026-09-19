"use server";

import { createClient } from "@/lib/supabase/server";

export async function markNotificationsViewed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ notifications_last_viewed_at: new Date().toISOString() })
    .eq("id", user.id);
}
