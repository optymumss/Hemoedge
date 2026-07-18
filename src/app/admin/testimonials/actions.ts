"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string } | undefined;

export async function createTestimonial(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const authorName = String(formData.get("author_name") ?? "").trim();
  const authorTitle = String(formData.get("author_title") ?? "").trim() || null;
  const quote = String(formData.get("quote") ?? "").trim();

  if (!authorName || !quote) return { error: "Author name and quote are required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("testimonials")
    .insert({ author_name: authorName, author_title: authorTitle, quote });

  if (error) return { error: error.message };

  revalidatePath("/admin/testimonials");
  return undefined;
}

export async function toggleTestimonialPublished(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nextPublished = formData.get("next_published") === "true";
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("testimonials").update({ published: nextPublished }).eq("id", id);

  revalidatePath("/admin/testimonials");
}
