"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addHotspot(
  exerciseId: string,
  xPct: number,
  yPct: number,
  cellTypeId: string,
): Promise<{ error?: string }> {
  if (!cellTypeId) return { error: "Choose a cell type." };

  const supabase = await createClient();
  const { error } = await supabase.from("wbc_diff_hotspots").insert({
    exercise_id: exerciseId,
    x_pct: xPct,
    y_pct: yPct,
    cell_type_id: cellTypeId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/wbc-diff/${exerciseId}/hotspots`);
  return {};
}

export async function deleteHotspot(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const exerciseId = String(formData.get("exercise_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("wbc_diff_hotspots").delete().eq("id", id);

  revalidatePath(`/admin/wbc-diff/${exerciseId}/hotspots`);
}
