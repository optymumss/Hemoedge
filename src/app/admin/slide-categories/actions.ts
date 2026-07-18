"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";

export type FormState = { error?: string } | undefined;

export async function createSlideCategory(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parent_id") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("slide_categories").insert({
    name,
    slug: slugify(name),
    parent_id: parentId,
    description,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/slide-categories");
  return undefined;
}
