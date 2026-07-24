"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string } | undefined;

export async function addLesson(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const moduleId = String(formData.get("module_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const slideId = String(formData.get("slide_id") ?? "") || null;

  if (!moduleId || !title) return { error: "Lesson title is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("module_id", moduleId);

  const { error } = await supabase.from("lessons").insert({
    module_id: moduleId,
    title,
    body: body || null,
    slide_id: slideId,
    position: count ?? 0,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/modules/${moduleId}/lessons`);
  return undefined;
}

export async function updateLesson(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const slideId = String(formData.get("slide_id") ?? "") || null;

  if (!id || !title) return { error: "Lesson title is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({ title, body: body || null, slide_id: slideId })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/admin/modules/${moduleId}/lessons`);
  return undefined;
}

export async function deleteLesson(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("lessons").delete().eq("id", id);

  revalidatePath(`/admin/modules/${moduleId}/lessons`);
}

export async function moveLesson(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || !moduleId) return;

  const supabase = await createClient();
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, position")
    .eq("module_id", moduleId)
    .order("position");

  if (!lessons) return;

  const index = lessons.findIndex((l) => l.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= lessons.length) return;

  const current = lessons[index];
  const neighbor = lessons[swapWith];

  await Promise.all([
    supabase.from("lessons").update({ position: neighbor.position }).eq("id", current.id),
    supabase.from("lessons").update({ position: current.position }).eq("id", neighbor.id),
  ]);

  revalidatePath(`/admin/modules/${moduleId}/lessons`);
}
