"use server";

import { createClient } from "@/lib/supabase/server";

/** Records that the current learner opened this slide, for the "Slides
 * Reviewed" dashboard stat. Upserts so repeat views don't create duplicate
 * rows — the stat counts distinct slides seen, not open-count. */
export async function recordSlideView(slideId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("slide_views")
    .upsert({ user_id: user.id, slide_id: slideId }, { onConflict: "user_id,slide_id", ignoreDuplicates: true });
}
