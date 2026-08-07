"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { ModuleForm } from "./module-form";

type ModuleSummary = {
  id: string;
  title: string;
  level: string;
  status: string;
};

export function ModulesLibraryShell({
  modules,
  children,
}: {
  modules: ModuleSummary[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const activeId = useMemo(() => {
    const match = pathname.match(/^\/admin\/modules\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  const filtered = useMemo(
    () => modules.filter((m) => m.title.toLowerCase().includes(query.toLowerCase())),
    [modules, query],
  );

  return (
    <div>
      <h1 className="text-xl font-semibold">Modules</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Teaching units — pick a module from the library to edit its details, lessons, and quiz.
      </p>

      <div className="mt-6 flex items-start gap-6">
        <aside className="w-72 shrink-0 rounded-lg border border-line">
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
              Module library
            </span>
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="rounded-md border border-line-strong px-2 py-1 text-xs text-ink hover:bg-surface-sunken"
              aria-expanded={creating}
            >
              {creating ? "Cancel" : "+ New"}
            </button>
          </div>

          {creating && (
            <div className="border-b border-line p-3">
              <ModuleForm />
            </div>
          )}

          <div className="border-b border-line p-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules…"
              className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
              aria-label="Search modules"
            />
          </div>

          <div className="max-h-[65vh] overflow-y-auto p-2">
            {filtered.map((m) => {
              const isActive = m.id === activeId;
              return (
                <Link
                  key={m.id}
                  href={`/admin/modules/${m.id}`}
                  className={`mb-1 flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
                    isActive ? "bg-accent-soft text-accent-soft-ink" : "text-ink hover:bg-surface-sunken"
                  }`}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{m.title}</span>
                    <span className="text-xs capitalize text-ink-faint">{m.level}</span>
                  </span>
                  <StatusBadge status={m.status} />
                </Link>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-2.5 py-6 text-center text-sm text-ink-faint">No modules found.</p>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
