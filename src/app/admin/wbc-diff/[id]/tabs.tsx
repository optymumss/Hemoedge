"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ExerciseTabs({ exerciseId }: { exerciseId: string }) {
  const pathname = usePathname();
  const detailsHref = `/admin/wbc-diff/${exerciseId}`;
  const hotspotsHref = `/admin/wbc-diff/${exerciseId}/hotspots`;

  const tabs = [
    { href: detailsHref, label: "Details", active: pathname === detailsHref },
    { href: hotspotsHref, label: "Hotspots", active: pathname === hotspotsHref },
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
