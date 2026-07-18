import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getActiveImpersonation } from "@/lib/auth/impersonation";
import { appNav, visibleFor } from "@/lib/nav";
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
  const sections = visibleFor(appNav, profile!.role);

  const identity = impersonation
    ? impersonation.target.fullName || impersonation.target.email
    : profile!.fullName || profile!.email;

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      {impersonation && <ImpersonationBanner name={identity} />}
      <div className="flex flex-1">
        <Sidebar
          title="HemoEdge"
          identity={identity}
          sections={sections}
          onLogout={logout}
        />
        <div className="flex-1 overflow-y-auto px-8 py-8">{children}</div>
        {!impersonation && <TutorWidget />}
      </div>
    </div>
  );
}
