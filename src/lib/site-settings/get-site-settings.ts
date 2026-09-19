import { createClient } from "@/lib/supabase/server";
import type { NavLink } from "./clean-nav-links";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const SITE_SETTINGS_ID = "00000000-0000-4000-8000-0000000000f1";

export type SiteSettingsData = {
  siteName: string;
  navLinks: NavLink[];
};

const DEFAULT_SITE_SETTINGS: SiteSettingsData = {
  siteName: "HemoEdge",
  navLinks: [
    { label: "Blog", href: "/blog" },
    { label: "Team", href: "/team" },
    { label: "Contact", href: "/contact" },
  ],
};

export async function getSiteSettings(supabase: SupabaseClient): Promise<SiteSettingsData> {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("site_name, nav_links")
      .eq("id", SITE_SETTINGS_ID)
      .maybeSingle();

    if (error || !data) return DEFAULT_SITE_SETTINGS;
    return {
      siteName: data.site_name,
      navLinks: (data.nav_links as NavLink[]) ?? [],
    };
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}
