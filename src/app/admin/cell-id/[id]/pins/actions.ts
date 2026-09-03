"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateGuardMessage } from "@/lib/content/update-guard";

export async function addPin(
  exerciseId: string,
  xPct: number,
  yPct: number,
  cellTypeId: string,
): Promise<{ error?: string }> {
  if (!cellTypeId) return { error: "Choose a cell type." };

  const supabase = await createClient();
  const { error } = await supabase.from("cell_id_hotspots").insert({
    exercise_id: exerciseId,
    x_pct: xPct,
    y_pct: yPct,
    cell_type_id: cellTypeId,
  });

  if (error) return { error: updateGuardMessage(error) ?? error.message };

  revalidatePath(`/admin/cell-id/${exerciseId}/pins`);
  return {};
}

export async function deletePin(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const exerciseId = String(formData.get("exercise_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("cell_id_hotspots").delete().eq("id", id);

  revalidatePath(`/admin/cell-id/${exerciseId}/pins`);
}
