"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveImpersonation } from "@/lib/auth/impersonation";

export async function addItem(formData: FormData) {
  const planId = String(formData.get("plan_id") ?? "");
  const target = String(formData.get("target") ?? "");
  if (!planId || !target) return;
  if (await getActiveImpersonation()) return;

  const [kind, targetId] = target.split(":");
  if (!targetId || (kind !== "module" && kind !== "curriculum")) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("onboarding_plan_items")
    .select("position")
    .eq("plan_id", planId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  await supabase.from("onboarding_plan_items").insert({
    plan_id: planId,
    module_id: kind === "module" ? targetId : null,
    curriculum_id: kind === "curriculum" ? targetId : null,
    position: nextPosition,
  });

  revalidatePath(`/org/onboarding/${planId}`);
}

export async function removeItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const planId = String(formData.get("plan_id") ?? "");
  if (!id) return;
  if (await getActiveImpersonation()) return;

  const supabase = await createClient();
  await supabase.from("onboarding_plan_items").delete().eq("id", id);
  revalidatePath(`/org/onboarding/${planId}`);
}

export async function assignLearner(formData: FormData) {
  const planId = String(formData.get("plan_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const dueDate = String(formData.get("due_date") ?? "") || null;
  if (!planId || !userId) return;
  if (await getActiveImpersonation()) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("onboarding_assignments").insert({
    plan_id: planId,
    user_id: userId,
    due_date: dueDate,
    assigned_by: user.id,
  });

  revalidatePath(`/org/onboarding/${planId}`);
}

export async function unassignLearner(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const planId = String(formData.get("plan_id") ?? "");
  if (!id) return;
  if (await getActiveImpersonation()) return;

  const supabase = await createClient();
  await supabase.from("onboarding_assignments").delete().eq("id", id);
  revalidatePath(`/org/onboarding/${planId}`);
}
