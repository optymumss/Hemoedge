import Link from "next/link";
import type { SiteSettingsData } from "@/lib/site-settings/get-site-settings";

export function PublicFooter({ siteSettings }: { siteSettings: SiteSettingsData }) {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-10 text-sm text-ink-dim sm:flex-row sm:justify-between">
        <span>
          &copy; {new Date().getFullYear()} {siteSettings.siteName}
        </span>
        <nav aria-label="Footer" className="flex items-center gap-5">
          {siteSettings.navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
