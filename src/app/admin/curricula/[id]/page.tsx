import { createClient } from "@/lib/supabase/server";
import { linkModule, unlinkModule, moveModule } from "./actions";
import { DetailsForm } from "./details-form";

export default async function PathwayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pathway } = await supabase
    .from("curricula")
    .select(
      "id, title, level, pass_threshold, status, description, pathway_type, learning_outcomes, certificate_awarded, certificate_title, cpd_points, estimated_completion_minutes, version",
    )
    .eq("id", id)
    .single();

  const { data: linked } = await supabase
    .from("curriculum_modules")
    .select("id, module_id, modules(title, status)")
    .eq("curriculum_id", id)
    .order("position");

  const { data: allModules } = await supabase
    .from("modules")
    .select("id, title, status")
    .order("title");

  const linkedIds = new Set((linked ?? []).map((l) => l.module_id));
  const available = (allModules ?? []).filter((m) => !linkedIds.has(m.id));

  if (!pathway) {
    return <p className="text-sm text-ink-dim">Learning pathway not found.</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">{pathway.title}</h1>
      <p className="mt-1 text-sm text-ink-dim">
        {pathway.level} · v{pathway.version} · {pathway.pass_threshold}% pass threshold · {pathway.status}
      </p>

      <div className="mt-6">
        <DetailsForm pathway={pathway} />
      </div>

      <div className="mt-6 rounded-lg border border-line p-4">
        <form action={linkModule} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="curriculum_id" value={pathway.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-dim" htmlFor="add-module">Add a module to this pathway</label>
            <select
              id="add-module"
              name="module_id"
              required
              defaultValue=""
              className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
            >
              <option value="" disabled>
                Choose a module…
              </option>
              {available.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.status})
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink"
          >
            Add module
          </button>
        </form>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
            <tr>
              <th className="px-4 py-2">Module</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(linked ?? []).map((l, index) => (
              <tr key={l.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{l.modules?.title}</td>
                <td className="px-4 py-2 capitalize text-ink-dim">{l.modules?.status}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <form action={moveModule}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="curriculum_id" value={pathway.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        disabled={index === 0}
                        aria-label="Move up"
                        className="rounded px-1.5 py-1 text-ink-dim hover:bg-surface-sunken disabled:opacity-30"
                      >
                        ↑
                      </button>
                    </form>
                    <form action={moveModule}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="curriculum_id" value={pathway.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        disabled={index === (linked ?? []).length - 1}
                        aria-label="Move down"
                        className="rounded px-1.5 py-1 text-ink-dim hover:bg-surface-sunken disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </form>
                    <form action={unlinkModule}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="curriculum_id" value={pathway.id} />
                      <button type="submit" className="ml-2 text-xs text-danger underline">
                        Remove
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {(linked ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ink-faint">
                  No modules linked yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
