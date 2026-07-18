import { getCurrentProfile } from "@/lib/auth/get-profile";
import { orgNav, visibleFor } from "@/lib/nav";
import { Sidebar } from "@/components/sidebar";
import { logout } from "@/app/login/actions";

export default async function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const sections = visibleFor(orgNav, profile!.role);

  return (
    <div className="flex min-h-screen flex-1">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-neutral-900 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <Sidebar
        title="Organization Portal"
        identity={profile!.fullName || profile!.email}
        sections={sections}
        onLogout={logout}
      />
      <main id="main-content" className="flex-1 overflow-y-auto px-8 py-8">
        {children}
      </main>
    </div>
  );
}
