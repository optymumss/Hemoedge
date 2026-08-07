import { createClient } from "@/lib/supabase/server";
import { addModuleTag, removeModuleTag, addModulePrerequisite, removeModulePrerequisite } from "./actions";
import { DetailsForm } from "./details-form";

export default async function ModuleDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: module_ },
    { data: tagLinks },
    { data: allTags },
    { data: prerequisiteLinks },
    { data: allModules },
  ] = await Promise.all([
    supabase
      .from("modules")
      .select(
        "id, title, level, description, module_type, learning_objectives, teaching_notes, estimated_duration_minutes, cpd_points",
      )
      .eq("id", id)
      .single(),
    supabase.from("module_tags").select("tag_id, tags(id, name)").eq("module_id", id),
    supabase.from("tags").select("id, name").order("name"),
    supabase
      .from("module_prerequisites")
      .select("prerequisite_module_id, modules!module_prerequisites_prerequisite_module_id_fkey(id, title)")
      .eq("module_id", id),
    supabase.from("modules").select("id, title").order("title"),
  ]);

  if (!module_) {
    return <p className="text-sm text-ink-dim">Module not found.</p>;
  }

  const linkedTagIds = new Set((tagLinks ?? []).map((t) => t.tag_id));
  const prerequisiteIds = new Set((prerequisiteLinks ?? []).map((p) => p.prerequisite_module_id));
  const availableModules = (allModules ?? []).filter(
    (m) => m.id !== id && !prerequisiteIds.has(m.id),
  );

  return (
    <div>
      <h1 className="text-lg font-semibold">Details</h1>
      <p className="mt-1 text-sm text-ink-dim">Core module fields, tags, and prerequisites.</p>

      <div className="mt-6">
        <DetailsForm module_={module_} />
      </div>

      <div className="mt-6 rounded-lg border border-line p-4">
        <h2 className="text-sm font-semibold">Tags</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {(tagLinks ?? []).map((t) =>
            t.tags ? (
              <span
                key={t.tag_id}
                className="flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-xs text-ink"
              >
                {t.tags.name}
                <form action={removeModuleTag}>
                  <input type="hidden" name="module_id" value={module_.id} />
                  <input type="hidden" name="tag_id" value={t.tag_id} />
                  <button type="submit" aria-label={`Remove tag ${t.tags.name}`} className="text-ink-faint hover:text-danger">
                    ×
                  </button>
                </form>
              </span>
            ) : null,
          )}
          {(tagLinks ?? []).length === 0 && <p className="text-sm text-ink-faint">No tags yet.</p>}
        </div>
        <form action={addModuleTag} className="mt-3 flex items-end gap-2">
          <input type="hidden" name="module_id" value={module_.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-dim" htmlFor="tag-name">Add a tag</label>
            <input
              id="tag-name"
              name="tag_name"
              list="existing-tags"
              placeholder="e.g. Anaemia"
              className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
            />
            <datalist id="existing-tags">
              {(allTags ?? [])
                .filter((t) => !linkedTagIds.has(t.id))
                .map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
            </datalist>
          </div>
          <button
            type="submit"
            className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken"
          >
            Add tag
          </button>
        </form>
      </div>

      <div className="mt-6 rounded-lg border border-line p-4">
        <h2 className="text-sm font-semibold">Prerequisite modules</h2>
        <div className="mt-2 flex flex-col gap-2">
          {(prerequisiteLinks ?? []).map((p) =>
            p.modules ? (
              <div
                key={p.prerequisite_module_id}
                className="flex items-center justify-between rounded-md bg-surface-sunken px-3 py-1.5 text-sm"
              >
                {p.modules.title}
                <form action={removeModulePrerequisite}>
                  <input type="hidden" name="module_id" value={module_.id} />
                  <input type="hidden" name="prerequisite_module_id" value={p.prerequisite_module_id} />
                  <button type="submit" className="text-xs text-danger underline">
                    Remove
                  </button>
                </form>
              </div>
            ) : null,
          )}
          {(prerequisiteLinks ?? []).length === 0 && (
            <p className="text-sm text-ink-faint">No prerequisites yet.</p>
          )}
        </div>
        <form action={addModulePrerequisite} className="mt-3 flex items-end gap-2">
          <input type="hidden" name="module_id" value={module_.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-dim" htmlFor="prerequisite-module">Add a prerequisite</label>
            <select
              id="prerequisite-module"
              name="prerequisite_module_id"
              required
              defaultValue=""
              className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
            >
              <option value="" disabled>
                Choose a module…
              </option>
              {availableModules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken"
          >
            Add prerequisite
          </button>
        </form>
      </div>
    </div>
  );
}
