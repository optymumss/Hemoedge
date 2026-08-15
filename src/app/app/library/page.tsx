import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const LINEAGE_LABEL: Record<string, string> = {
  red_cell: "Red cells",
  white_cell: "White cells",
  platelet: "Platelets",
};
const LINEAGES = Object.keys(LINEAGE_LABEL);

export default async function LearnerLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ lineage?: string }>;
}) {
  const { lineage } = await searchParams;
  const activeLineage = lineage && LINEAGES.includes(lineage) ? lineage : null;

  const supabase = await createClient();
  let query = supabase
    .from("features")
    .select("id, title, definition, cell_types(name, lineage)")
    .eq("status", "published")
    .order("title");
  if (activeLineage) query = query.eq("cell_types.lineage", activeLineage);

  const { data: features } = await query;
  // .eq() on an embedded relation filters which related rows are joined, not
  // which parent rows come back — a feature with no white_cell type still
  // returns with cell_types: null, so unmatched parents need dropping here.
  const filtered = activeLineage
    ? (features ?? []).filter((f) => f.cell_types !== null)
    : (features ?? []);

  return (
    <div>
      <h1 className="text-xl font-semibold">Library</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Reference articles on haematological features and morphology.
      </p>

      <div className="mt-4 flex flex-wrap gap-1 rounded-md border border-line-strong bg-surface-sunken p-1" role="group" aria-label="Browse by cell line">
        <Link
          href="/app/library"
          className={`rounded px-2.5 py-1 text-xs font-medium ${
            !activeLineage ? "bg-accent text-accent-ink" : "text-ink-dim hover:bg-surface-raised"
          }`}
        >
          All
        </Link>
        {LINEAGES.map((l) => (
          <Link
            key={l}
            href={`/app/library?lineage=${l}`}
            className={`rounded px-2.5 py-1 text-xs font-medium ${
              activeLineage === l ? "bg-accent text-accent-ink" : "text-ink-dim hover:bg-surface-raised"
            }`}
          >
            {LINEAGE_LABEL[l]}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((f) => (
          <Link
            key={f.id}
            href={`/app/library/${f.id}`}
            className="rounded-lg border border-line p-4 hover:border-line-strong hover:bg-surface-raised"
          >
            {f.cell_types?.name && (
              <span className="text-xs uppercase text-ink-faint">
                {f.cell_types.name}
              </span>
            )}
            <h2 className="mt-1 font-medium">{f.title}</h2>
            {f.definition && (
              <p className="mt-1 line-clamp-3 text-sm text-ink-dim">
                {f.definition}
              </p>
            )}
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-ink-faint">
            {activeLineage ? "Nothing published in this category yet." : "Nothing published yet."}
          </p>
        )}
      </div>
    </div>
  );
}
