import type { AppRole } from "@/lib/auth/roles";

export type NavItem = { label: string; href: string; roles?: AppRole[] };
export type NavSection = { section: string; items: NavItem[] };

export const adminNav: NavSection[] = [
  {
    section: "Platform",
    items: [
      { label: "Dashboard", href: "/admin" },
      { label: "Review Queue", href: "/admin/review-queue" },
      { label: "Tiers", href: "/admin/tiers", roles: ["super_admin"] },
      { label: "Organizations", href: "/admin/organizations", roles: ["super_admin"] },
      { label: "Learners", href: "/admin/learners", roles: ["super_admin"] },
    ],
  },
  {
    section: "Library Management",
    items: [
      { label: "Slides", href: "/admin/slides" },
      { label: "Slide Categories", href: "/admin/slide-categories" },
      { label: "Cell Types", href: "/admin/cell-types" },
      { label: "Features", href: "/admin/features" },
    ],
  },
  {
    section: "Module Management",
    items: [
      { label: "Modules", href: "/admin/modules" },
      { label: "Curricula", href: "/admin/curricula" },
    ],
  },
  {
    section: "Case Management",
    items: [{ label: "Cases", href: "/admin/cases" }],
  },
  {
    section: "Website",
    items: [
      { label: "Pages", href: "/admin/pages", roles: ["super_admin"] },
      { label: "Site Settings", href: "/admin/site-settings", roles: ["super_admin"] },
      { label: "Blog", href: "/admin/blog", roles: ["super_admin"] },
      { label: "Testimonials", href: "/admin/testimonials", roles: ["super_admin"] },
      { label: "Associates", href: "/admin/associates", roles: ["super_admin"] },
      { label: "Enquiries", href: "/admin/enquiries", roles: ["super_admin"] },
    ],
  },
];

export const orgNav: NavSection[] = [
  {
    section: "Organization",
    items: [
      { label: "Dashboard", href: "/org" },
      { label: "Roster", href: "/org/roster" },
      { label: "Catalog", href: "/org/catalog" },
      { label: "Analytics", href: "/org/analytics" },
      { label: "Reports", href: "/org/reports" },
      { label: "Billing", href: "/org/billing" },
    ],
  },
];

export const appNav: NavSection[] = [
  {
    section: "Learning",
    items: [
      { label: "Dashboard", href: "/app" },
      { label: "Modules", href: "/app/modules" },
      { label: "Cases", href: "/app/cases" },
      { label: "Library", href: "/app/library" },
      { label: "Competency", href: "/app/competency" },
      { label: "Certificates", href: "/app/certificates" },
    ],
  },
];

export function visibleFor(nav: NavSection[], role: AppRole): NavSection[] {
  return nav
    .map((section) => ({
      section: section.section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);
}
