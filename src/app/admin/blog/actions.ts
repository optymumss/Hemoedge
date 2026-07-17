"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";

export type FormState = { error?: string } | undefined;

export async function createPost(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim() || null;
  const content = String(formData.get("content") ?? "").trim() || null;

  if (!title) return { error: "Title is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("blog_posts")
    .insert({ title, slug: slugify(title), excerpt, content });

  if (error) {
    return {
      error: error.code === "23505" ? "A post with that title already exists." : error.message,
    };
  }

  revalidatePath("/admin/blog");
  return undefined;
}

export async function togglePostStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nextStatus = String(formData.get("next_status") ?? "");
  if (!id || !["draft", "published"].includes(nextStatus)) return;

  const supabase = await createClient();
  await supabase
    .from("blog_posts")
    .update({
      status: nextStatus,
      published_at: nextStatus === "published" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  revalidatePath("/admin/blog");
}
