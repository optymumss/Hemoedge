"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { updateSlideCategory, deleteSlideCategory, type FormState } from "./actions";

export type CategoryRow = {
  id: string;
  name: string;
  parentId: string | null;
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

export function CategoriesTable({
  rows,
  parents,
}: {
  rows: CategoryRow[];
  parents: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ColumnKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({
    name: true,
    parent: true,
    description: true,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.parentName ?? "").toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const cmp = columnValue(a, sortKey).localeCompare(columnValue(b, sortKey));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const visibleColumns = COLUMNS.filter((c) => visible[c.key]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <input
          type="search"
          placeholder="Search categories…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-xs rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
        <div ref={menuRef} className="relative shrink-0">
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
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) =>
              editingId === r.id ? (
                <EditRow
                  key={r.id}
                  category={r}
                  parents={parents.filter((p) => p.id !== r.id)}
                  colSpan={visibleColumns.length + 1}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <tr key={r.id} className="border-t border-line">
                  {visible.name && <td className="px-4 py-2 font-medium">{r.name}</td>}
                  {visible.parent && (
                    <td className="px-4 py-2 text-ink-dim">{r.parentName ?? "—"}</td>
                  )}
                  {visible.description && (
                    <td className="px-4 py-2 text-ink-dim">{r.description ?? "—"}</td>
                  )}
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingId(r.id)}
                        className="text-xs text-ink-dim underline"
                      >
                        Edit
                      </button>
                      <form
                        action={deleteSlideCategory}
                        onSubmit={(e) => {
                          if (!confirm(`Delete "${r.name}"?`)) e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="text-xs text-danger underline">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="px-4 py-6 text-center text-ink-faint">
                  {rows.length === 0 ? "No categories yet." : "No categories match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditRow({
  category,
  parents,
  colSpan,
  onDone,
}: {
  category: CategoryRow;
  parents: { id: string; name: string }[];
  colSpan: number;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateSlideCategory,
    undefined,
  );

  return (
    <tr className="border-t border-line bg-surface-sunken/50">
      <td colSpan={colSpan} className="px-4 py-3">
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={category.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-dim">Name</label>
            <input
              name="name"
              required
              defaultValue={category.name}
              className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-dim">Parent</label>
            <select
              name="parent_id"
              defaultValue={category.parentId ?? ""}
              className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
            >
              <option value="">— Top level (Syndrome Group) —</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs text-ink-dim">Description</label>
            <input
              name="description"
              defaultValue={category.description ?? ""}
              className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink-dim hover:bg-surface-sunken"
          >
            Close
          </button>
          {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
        </form>
      </td>
    </tr>
  );
}
