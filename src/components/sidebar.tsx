"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/lib/nav";

export function Sidebar({
  title,
  identity,
  sections,
  onLogout,
}: {
  title: string;
  identity: string;
  sections: NavSection[];
  onLogout: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 px-4 py-6">
      <p className="px-2 text-sm font-semibold">{title}</p>
      <nav className="mt-6 flex flex-1 flex-col gap-5">
        {sections.map((section) => (
          <div key={section.section}>
            <p className="px-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
              {section.section}
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block rounded-md px-2 py-1.5 text-sm ${
                        active
                          ? "bg-neutral-900 text-white"
                          : "text-neutral-700 hover:bg-neutral-200"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="mt-6 border-t border-neutral-200 pt-4">
        <p className="truncate px-2 text-xs text-neutral-500">{identity}</p>
        <form action={onLogout}>
          <button
            type="submit"
            className="mt-1 px-2 text-sm text-neutral-700 underline"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
