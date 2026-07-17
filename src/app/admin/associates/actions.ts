"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string } | undefined;

export async function createAssociate(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;

  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("associates").insert({ name, title, bio });

  if (error) return { error: error.message };

  revalidatePath("/admin/associates");
  return undefined;
}
