import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getActiveImpersonation } from "@/lib/auth/impersonation";
import { appNav, visibleFor } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { Sidebar } from "@/components/sidebar";
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
      <div className="flex flex-1">
        <Sidebar
          title="HemoEdge"
          identity={identity}
          role={ROLE_LABELS[effectiveRole]}
          sections={sections}
          onLogout={logout}
        />
        <main id="main-content" className="flex-1 overflow-y-auto px-8 py-8">
          {children}
        </main>
        {!impersonation && <TutorWidget />}
      </div>
    </div>
  );
}
