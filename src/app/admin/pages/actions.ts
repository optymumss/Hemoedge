"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";
import type { Enums } from "@/lib/supabase/database.types";

export type FormState = { error?: string } | undefined;

const TYPES: Enums<"page_type">[] = ["homepage", "about", "contact", "pilot", "custom"];

export async function createPage(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "custom") as Enums<"page_type">;
  const content = String(formData.get("content") ?? "").trim() || null;

  if (!title) return { error: "Title is required." };
  if (!TYPES.includes(type)) return { error: "Invalid page type." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("pages")
    .insert({ title, slug: slugify(title), type, content });

  if (error) {
    return {
      error: error.code === "23505" ? "A page with that title already exists." : error.message,
    };
  }

  revalidatePath("/admin/pages");
  return undefined;
}

export async function togglePageStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nextStatus = String(formData.get("next_status") ?? "");
  if (!id || !["draft", "published"].includes(nextStatus)) return;

  const supabase = await createClient();
  await supabase.from("pages").update({ status: nextStatus }).eq("id", id);

  revalidatePath("/admin/pages");
}
