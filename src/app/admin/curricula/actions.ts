"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type FormState = { error?: string } | undefined;

const LEVELS: Enums<"content_level">[] = ["beginner", "intermediate", "advanced"];

export async function createCurriculum(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const level = String(formData.get("level") ?? "") as Enums<"content_level">;
  const passThreshold = Number(formData.get("pass_threshold") ?? 70);

  if (!title) return { error: "Title is required." };
  if (!LEVELS.includes(level)) {
    return { error: "Choose a level." };
  }
  if (!Number.isFinite(passThreshold) || passThreshold < 1 || passThreshold > 100) {
    return { error: "Pass threshold must be between 1 and 100." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("curricula").insert({
    title,
    level,
    pass_threshold: passThreshold,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/curricula");
  return undefined;
}
