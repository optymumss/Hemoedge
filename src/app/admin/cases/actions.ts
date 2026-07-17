"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type FormState = { error?: string } | undefined;

const LEVELS: Enums<"content_level">[] = ["beginner", "intermediate", "advanced"];

export async function createCase(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const level = String(formData.get("level") ?? "") as Enums<"content_level">;

  if (!title) return { error: "Title is required." };
  if (!LEVELS.includes(level)) {
    return { error: "Choose a level." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("cases")
    .insert({ title, level, created_by: user.id });

  if (error) return { error: error.message };

  revalidatePath("/admin/cases");
  return undefined;
}
