"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ModuleTabs({ moduleId }: { moduleId: string }) {
  const pathname = usePathname();
  const detailsHref = `/admin/modules/${moduleId}`;
  const lessonsHref = `/admin/modules/${moduleId}/lessons`;
  const quizHref = `/admin/modules/${moduleId}/quiz`;

  const tabs = [
    { href: detailsHref, label: "Details", active: pathname === detailsHref },
    { href: lessonsHref, label: "Lessons", active: pathname === lessonsHref },
    { href: quizHref, label: "Quiz", active: pathname === quizHref },
  ];

  return (
    <nav aria-label="Module sections" className="flex gap-1 border-b border-line">
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
