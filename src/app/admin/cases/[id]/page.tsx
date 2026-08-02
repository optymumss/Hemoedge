import { createClient } from "@/lib/supabase/server";
import {
  addCaseTag,
  removeCaseTag,
  addCaseFeature,
  removeCaseFeature,
} from "./actions";
import { DetailsForm } from "./details-form";

export default async function CaseDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: case_ },
    { data: slides },
    { data: tagLinks },
    { data: allTags },
    { data: featureLinks },
    { data: allFeatures },
  ] = await Promise.all([
    supabase
      .from("cases")
      .select(
        "id, title, level, description, slide_id, case_context, lab_values, final_diagnosis, learning_points, estimated_time_minutes, cpd_points",
      )
      .eq("id", id)
      .single(),
    supabase.from("slides").select("id, title").order("title"),
    supabase.from("case_tags").select("tag_id, tags(id, name)").eq("case_id", id),
    supabase.from("tags").select("id, name").order("name"),
    supabase.from("case_features").select("feature_id, features(id, title)").eq("case_id", id),
    supabase.from("features").select("id, title").order("title"),
  ]);

  if (!case_) {
    return <p className="text-sm text-ink-dim">Case study not found.</p>;
  }

  const linkedTagIds = new Set((tagLinks ?? []).map((t) => t.tag_id));
  const linkedFeatureIds = new Set((featureLinks ?? []).map((f) => f.feature_id));
  const availableFeatures = (allFeatures ?? []).filter((f) => !linkedFeatureIds.has(f.id));

  return (
    <div>
      <h1 className="text-xl font-semibold">{case_.title} — Details</h1>
      <p className="mt-1 text-sm text-ink-dim">Core case study fields, WSI slide, tags, and linked features.</p>

      <div className="mt-6">
        <DetailsForm case_={case_} slides={slides ?? []} />
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
                <form action={removeCaseTag}>
                  <input type="hidden" name="case_id" value={case_.id} />
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
        <form action={addCaseTag} className="mt-3 flex items-end gap-2">
          <input type="hidden" name="case_id" value={case_.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-dim" htmlFor="tag-name">Add a tag</label>
            <input
              id="tag-name"
              name="tag_name"
              list="existing-tags"
              placeholder="e.g. Iron deficiency"
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
        <h2 className="text-sm font-semibold">Linked features</h2>
        <p className="mt-1 text-xs text-ink-faint">
          Feature Library entries this case demonstrates — shown to learners and used by the AI Tutor.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {(featureLinks ?? []).map((f) =>
            f.features ? (
              <div
                key={f.feature_id}
                className="flex items-center justify-between rounded-md bg-surface-sunken px-3 py-1.5 text-sm"
              >
                {f.features.title}
                <form action={removeCaseFeature}>
                  <input type="hidden" name="case_id" value={case_.id} />
                  <input type="hidden" name="feature_id" value={f.feature_id} />
                  <button type="submit" className="text-xs text-danger underline">
                    Remove
                  </button>
                </form>
              </div>
            ) : null,
          )}
          {(featureLinks ?? []).length === 0 && (
            <p className="text-sm text-ink-faint">No linked features yet.</p>
          )}
        </div>
        <form action={addCaseFeature} className="mt-3 flex items-end gap-2">
          <input type="hidden" name="case_id" value={case_.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-dim" htmlFor="feature-id">Link a feature</label>
            <select
              id="feature-id"
              name="feature_id"
              required
              defaultValue=""
              className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
            >
              <option value="" disabled>
                Choose a feature…
              </option>
              {availableFeatures.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken"
          >
            Add feature
          </button>
        </form>
      </div>
    </div>
  );
}
