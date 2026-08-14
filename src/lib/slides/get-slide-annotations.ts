"use server";

import { createClient } from "@/lib/supabase/server";

export type SlideAnnotation = { id: string; x_pct: number; y_pct: number; label: string; body: string | null };

export async function getSlideAnnotations(slideId: string): Promise<SlideAnnotation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("slide_annotations")
    .select("id, x_pct, y_pct, label, body")
    .eq("slide_id", slideId)
    .order("position");
  return data ?? [];
}
