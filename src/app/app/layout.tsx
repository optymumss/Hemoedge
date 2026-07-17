import { getCurrentProfile } from "@/lib/auth/get-profile";
import { appNav, visibleFor } from "@/lib/nav";
import { Sidebar } from "@/components/sidebar";
import { logout } from "@/app/login/actions";

export default async function LearnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const sections = visibleFor(appNav, profile!.role);

  return (
    <div className="flex min-h-screen flex-1">
      <Sidebar
        title="HemoEdge"
        identity={profile!.fullName || profile!.email}
        sections={sections}
        onLogout={logout}
      />
      <div className="flex-1 overflow-y-auto px-8 py-8">{children}</div>
    </div>
  );
}
