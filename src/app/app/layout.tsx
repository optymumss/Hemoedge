import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getActiveImpersonation } from "@/lib/auth/impersonation";
import { appNav, visibleFor } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { TutorWidget } from "@/components/tutor-widget";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { logout } from "@/app/login/actions";

export default async function LearnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const impersonation = await getActiveImpersonation();
  const effectiveRole = impersonation?.target.role ?? profile!.role;
  const sections = visibleFor(appNav, effectiveRole);

  const identity = impersonation
    ? impersonation.target.fullName || impersonation.target.email
    : profile!.fullName || profile!.email;

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-accent-ink"
      >
        Skip to content
      </a>
      {impersonation && <ImpersonationBanner name={identity} />}
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar
          tagline="BLOOD FILM LEARNING"
          identity={identity}
          role={ROLE_LABELS[effectiveRole]}
          sections={sections}
          settingsHref="/app/settings"
          onLogout={logout}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <Header identity={identity} />
          <main id="main-content" className="px-4 py-4 sm:px-6 sm:py-5">{children}</main>
        </div>
        {!impersonation && <TutorWidget />}
      </div>
    </div>
  );
}
