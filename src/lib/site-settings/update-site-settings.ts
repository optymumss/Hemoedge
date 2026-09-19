"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cleanNavLinks, type NavLink } from "./clean-nav-links";
import { SITE_SETTINGS_ID } from "./get-site-settings";

export async function updateSiteSettings(
  siteName: string,
  navLinks: NavLink[],
): Promise<{ error: string } | { success: true }> {
  const trimmedName = siteName.trim();
  if (!trimmedName) return { error: "Site name is required." };

  const cleaned = cleanNavLinks(navLinks);

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .update({ site_name: trimmedName, nav_links: cleaned, updated_at: new Date().toISOString() })
    .eq("id", SITE_SETTINGS_ID);

  if (error) return { error: "Something went wrong — check your connection and try again." };

  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/team");
  revalidatePath("/contact");
  revalidatePath("/admin/site-settings");
  return { success: true };
}
