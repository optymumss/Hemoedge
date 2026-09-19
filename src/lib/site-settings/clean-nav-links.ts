export type NavLink = { label: string; href: string };

const MAX_NAV_LINKS = 8;

export function cleanNavLinks(raw: NavLink[]): NavLink[] {
  return raw
    .map((l) => ({ label: l.label.trim(), href: l.href.trim() }))
    .filter((l) => l.label.length > 0 && l.href.length > 0)
    .slice(0, MAX_NAV_LINKS);
}
