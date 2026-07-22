"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type CategoryRow = {
  id: string;
  name: string;
  parentName: string | null;
  description: string | null;
};

type ColumnKey = "name" | "parent" | "description";
type SortDir = "asc" | "desc";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "parent", label: "Parent" },
  { key: "description", label: "Description" },
];

function columnValue(row: CategoryRow, key: ColumnKey): string {
  if (key === "name") return row.name;
  if (key === "parent") return row.parentName ?? "";
  return row.description ?? "";
}

export function CategoriesTable({ rows }: { rows: CategoryRow[] }) {
  const [sortKey, setSortKey] = useState<ColumnKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({
    name: true,
    parent: true,
    description: true,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggleSort(key: ColumnKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleColumn(key: ColumnKey) {
    setVisible((v) => {
      const nextValue = !v[key];
      const visibleCount = Object.values(v).filter(Boolean).length;
      // Keep at least one column visible.
      if (!nextValue && visibleCount <= 1) return v;
      return { ...v, [key]: nextValue };
    });
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const cmp = columnValue(a, sortKey).localeCompare(columnValue(b, sortKey));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const visibleColumns = COLUMNS.filter((c) => visible[c.key]);

  return (
    <div>
      <div className="flex justify-end">
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken"
          >
            View
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-line bg-surface-raised p-2 shadow-md">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                Toggle columns
              </p>
              {COLUMNS.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-ink hover:bg-surface-sunken"
                >
                  <input
                    type="checkbox"
                    checked={visible[c.key]}
                    onChange={() => toggleColumn(c.key)}
                    className="accent-accent"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
            <tr>
              {visibleColumns.map((c) => (
                <th key={c.key} className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className="flex items-center gap-1 hover:text-ink"
                  >
                    {c.label}
                    <span aria-hidden="true" className="text-ink-faint">
                      {sortKey === c.key ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-t border-line">
                {visible.name && <td className="px-4 py-2 font-medium">{r.name}</td>}
                {visible.parent && (
                  <td className="px-4 py-2 text-ink-dim">{r.parentName ?? "—"}</td>
                )}
                {visible.description && (
                  <td className="px-4 py-2 text-ink-dim">{r.description ?? "—"}</td>
                )}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-6 text-center text-ink-faint">
                  No categories yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
