"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string } | undefined;

export async function createFeature(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const definition = String(formData.get("definition") ?? "").trim() || null;
  const cellTypeId = String(formData.get("cell_type_id") ?? "") || null;

  if (!title) return { error: "Title is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("features").insert({
    title,
    definition,
    cell_type_id: cellTypeId,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/features");
  return undefined;
}
