"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ExerciseTabs({ exerciseId }: { exerciseId: string }) {
  const pathname = usePathname();
  const detailsHref = `/admin/cell-id/${exerciseId}`;
  const pinsHref = `/admin/cell-id/${exerciseId}/pins`;

  const tabs = [
    { href: detailsHref, label: "Details", active: pathname === detailsHref },
    { href: pinsHref, label: "Pins", active: pathname === pinsHref },
  ];

  return (
    <nav aria-label="Exercise sections" className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            t.active
              ? "border-accent text-ink"
              : "border-transparent text-ink-dim hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
