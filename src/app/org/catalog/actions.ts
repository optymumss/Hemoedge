"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleCatalogSelection(formData: FormData) {
  const orgId = String(formData.get("org_id") ?? "");
  const contentType = String(formData.get("content_type") ?? "");
  const contentId = String(formData.get("content_id") ?? "");
  const selected = formData.get("selected") === "true";

  if (!orgId || !contentType || !contentId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  if (selected) {
    await supabase
      .from("org_catalog_selections")
      .delete()
      .eq("org_id", orgId)
      .eq("content_type", contentType)
      .eq("content_id", contentId);
  } else {
    await supabase.from("org_catalog_selections").insert({
      org_id: orgId,
      content_type: contentType,
      content_id: contentId,
      added_by: user.id,
    });
  }

  revalidatePath("/org/catalog");
}
