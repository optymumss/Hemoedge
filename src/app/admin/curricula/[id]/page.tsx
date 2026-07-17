import { createClient } from "@/lib/supabase/server";
import { linkModule, unlinkModule } from "./actions";

export default async function CurriculumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: curriculum } = await supabase
    .from("curricula")
    .select("id, title, level, pass_threshold, status")
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

  if (!curriculum) {
    return <p className="text-sm text-neutral-500">Curriculum not found.</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">{curriculum.title}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {curriculum.level} · {curriculum.pass_threshold}% pass threshold · {curriculum.status}
      </p>

      <div className="mt-6 rounded-lg border border-neutral-200 p-4">
        <form action={linkModule} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="curriculum_id" value={curriculum.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Add a module to this stage</label>
            <select
              name="module_id"
              required
              defaultValue=""
              className="w-64 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
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
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Add module
          </button>
        </form>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Module</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(linked ?? []).map((l) => (
              <tr key={l.id} className="border-t border-neutral-200">
                <td className="px-4 py-2 font-medium">{l.modules?.title}</td>
                <td className="px-4 py-2 capitalize text-neutral-500">{l.modules?.status}</td>
                <td className="px-4 py-2 text-right">
                  <form action={unlinkModule}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="curriculum_id" value={curriculum.id} />
                    <button type="submit" className="text-xs text-red-600 underline">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(linked ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">
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
