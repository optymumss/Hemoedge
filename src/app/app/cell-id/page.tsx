import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function LearnerCellIdPage() {
  const supabase = await createClient();
  const { data: exercises } = await supabase
    .from("cell_id_exercises")
    .select("id, title, level, instructions")
    .eq("status", "published")
    .order("title");

  return (
    <div>
      <h1 className="text-xl font-semibold">Cell Identification</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Practice identifying selected cells on real slides. Click each highlighted cell, name
        it, and see how you scored against the ground truth.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(exercises ?? []).map((e) => (
          <Link
            key={e.id}
            href={`/app/cell-id/${e.id}`}
            className="rounded-lg border border-line p-4 hover:border-line-strong"
          >
            <span className="text-xs uppercase text-ink-faint">{e.level}</span>
            <h2 className="mt-1 font-medium">{e.title}</h2>
            {e.instructions && (
              <p className="mt-1 line-clamp-3 text-sm text-ink-dim">{e.instructions}</p>
            )}
          </Link>
        ))}
        {(exercises ?? []).length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-ink-faint">
            No exercises published yet.
          </p>
        )}
      </div>
    </div>
  );
}
