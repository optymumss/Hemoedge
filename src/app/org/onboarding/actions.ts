"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveImpersonation } from "@/lib/auth/impersonation";

export type FormState = { error?: string } | undefined;

export async function createPlan(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const orgId = String(formData.get("org_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!orgId || !name) return { error: "Name is required." };
  if (await getActiveImpersonation()) {
    return { error: "Onboarding plan changes are disabled while viewing as another user." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("onboarding_plans")
    .insert({ org_id: orgId, name, description, created_by: user.id })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Couldn't create plan." };

  revalidatePath("/org/onboarding");
  redirect(`/org/onboarding/${data.id}`);
}

export async function deletePlan(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  if (await getActiveImpersonation()) return;

  const supabase = await createClient();
  await supabase.from("onboarding_plans").delete().eq("id", id);
  revalidatePath("/org/onboarding");
}
