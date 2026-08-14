"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addAnnotation(
  slideId: string,
  xPct: number,
  yPct: number,
  label: string,
  body: string,
): Promise<{ error?: string }> {
  if (!label.trim()) return { error: "Label is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("slide_annotations").insert({
    slide_id: slideId,
    x_pct: xPct,
    y_pct: yPct,
    label: label.trim(),
    body: body.trim() || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/slides/${slideId}/annotations`);
  return {};
}

export async function deleteAnnotation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const slideId = String(formData.get("slide_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("slide_annotations").delete().eq("id", id);

  revalidatePath(`/admin/slides/${slideId}/annotations`);
}
