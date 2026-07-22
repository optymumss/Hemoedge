import { getCurrentProfile } from "@/lib/auth/get-profile";
import { AccountSettings } from "@/components/account-settings/account-settings";

export default async function AdminSettingsPage() {
  const profile = await getCurrentProfile();

  return (
    <div>
      <h1 className="text-xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-ink-dim">Manage your profile and account settings.</p>

      <div className="mt-6">
        <AccountSettings
          fullName={profile!.fullName ?? ""}
          email={profile!.email}
          canDeleteAccount={profile!.role !== "super_admin"}
        />
      </div>
    </div>
  );
}
