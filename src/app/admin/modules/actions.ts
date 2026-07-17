"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type FormState = { error?: string } | undefined;

const LEVELS: Enums<"content_level">[] = ["beginner", "intermediate", "advanced"];

export async function createModule(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const level = String(formData.get("level") ?? "") as Enums<"content_level">;
  const description = String(formData.get("description") ?? "").trim() || null;

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
    .from("modules")
    .insert({ title, level, description, created_by: user.id });

  if (error) return { error: error.message };

  revalidatePath("/admin/modules");
  return undefined;
}
