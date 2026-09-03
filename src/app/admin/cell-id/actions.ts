"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type FormState = { error?: string } | undefined;

const LEVELS: Enums<"content_level">[] = ["beginner", "intermediate", "advanced"];

export async function createExercise(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const level = String(formData.get("level") ?? "") as Enums<"content_level">;
  const slideId = String(formData.get("slide_id") ?? "");

  if (!title) return { error: "Title is required." };
  if (!LEVELS.includes(level)) return { error: "Choose a level." };
  if (!slideId) return { error: "Choose a slide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("cell_id_exercises")
    .insert({ title, level, slide_id: slideId, created_by: user.id })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/admin/cell-id");
  redirect(`/admin/cell-id/${data.id}`);
}
