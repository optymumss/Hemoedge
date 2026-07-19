import { createClient } from "@/lib/supabase/server";

export default async function LearnerLibraryPage() {
  const supabase = await createClient();
  const { data: features } = await supabase
    .from("features")
    .select("id, title, definition, cell_types(name)")
    .eq("status", "published")
    .order("title");

  return (
    <div>
      <h1 className="text-xl font-semibold">Library</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Reference articles on haematological features and morphology.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(features ?? []).map((f) => (
          <div key={f.id} className="rounded-lg border border-line p-4">
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
          </div>
        ))}
        {(features ?? []).length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-ink-faint">
            Nothing published yet.
          </p>
        )}
      </div>
    </div>
  );
}
