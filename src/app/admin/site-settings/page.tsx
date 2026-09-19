import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { ComingSoon } from "@/components/coming-soon";
import { getSiteSettings } from "@/lib/site-settings/get-site-settings";
import { SiteSettingsForm } from "./site-settings-form";

export default async function SiteSettingsPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") {
    return (
      <ComingSoon
        title="Super Admin only"
        description="Site settings are managed by HemoEdge staff."
      />
    );
  }

  const supabase = await createClient();
  const siteSettings = await getSiteSettings(supabase);

  return (
    <div>
      <h1 className="text-xl font-semibold">Site Settings</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Logo, navigation, and footer links for the public marketing site.
      </p>

      <div className="mt-6 max-w-xl rounded-lg border border-line p-4">
        <SiteSettingsForm initial={siteSettings} />
      </div>
    </div>
  );
}
