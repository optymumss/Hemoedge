"use client";

import { useActionState, useMemo, useState } from "react";
import { updateCellType, deleteCellType, type FormState } from "./actions";

export type CellTypeRow = {
  id: string;
  name: string;
  code: string;
  lineage: string;
  description: string | null;
  is_wbc_diff_countable: boolean;
};

type SortKey = "name" | "code" | "lineage";
type SortDir = "asc" | "desc";

const LINEAGE_LABEL: Record<string, string> = {
  red_cell: "Red Cell",
  white_cell: "White Cell",
  platelet: "Platelet",
};

function sortValue(row: CellTypeRow, key: SortKey): string {
  if (key === "lineage") return LINEAGE_LABEL[row.lineage] ?? row.lineage;
  return row[key];
}

export function CellTypesTable({ rows }: { rows: CellTypeRow[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingId, setEditingId] = useState<string | null>(null);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  return (
    <div>
      <input
        type="search"
        placeholder="Search cell types…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full max-w-xs rounded-md border border-line-strong px-2 py-1.5 text-sm"
      />

      <div className="mt-3 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
            <tr>
              {(
                [
                  { key: "name" as const, label: "Name" },
                  { key: "code" as const, label: "Code" },
                  { key: "lineage" as const, label: "Lineage" },
                ]
              ).map((c) => (
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
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">WBC diff</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) =>
              editingId === c.id ? (
                <EditRow key={c.id} cellType={c} onDone={() => setEditingId(null)} />
              ) : (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs font-mono">
                      {c.code}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ink-dim">
                    {LINEAGE_LABEL[c.lineage] ?? c.lineage}
                  </td>
                  <td className="px-4 py-2 text-ink-dim">{c.description ?? "—"}</td>
                  <td className="px-4 py-2 text-ink-dim">{c.is_wbc_diff_countable ? "Yes" : "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingId(c.id)}
                        className="text-xs text-ink-dim underline"
                      >
                        Edit
                      </button>
                      <form
                        action={deleteCellType}
                        onSubmit={(e) => {
                          if (!confirm(`Delete "${c.name}"?`)) e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="id" value={c.id} />
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
                <td colSpan={6} className="px-4 py-6 text-center text-ink-faint">
                  {rows.length === 0 ? "No cell types yet." : "No cell types match your search."}
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
  cellType,
  onDone,
}: {
  cellType: CellTypeRow;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateCellType,
    undefined,
  );

  return (
    <tr className="border-t border-line bg-surface-sunken/50">
      <td colSpan={6} className="px-4 py-3">
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={cellType.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-dim">Name</label>
            <input
              name="name"
              required
              defaultValue={cellType.name}
              className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-dim">Code</label>
            <input
              name="code"
              required
              maxLength={5}
              defaultValue={cellType.code}
              className="w-20 rounded-md border border-line-strong px-2 py-1.5 text-sm uppercase"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-dim">Lineage</label>
            <select
              name="lineage"
              required
              defaultValue={cellType.lineage}
              className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
            >
              <option value="red_cell">Red Cell</option>
              <option value="white_cell">White Cell</option>
              <option value="platelet">Platelet</option>
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs text-ink-dim">Description</label>
            <input
              name="description"
              defaultValue={cellType.description ?? ""}
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
