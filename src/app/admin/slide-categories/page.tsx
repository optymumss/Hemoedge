import { createClient } from "@/lib/supabase/server";
import { CategoryForm } from "./category-form";

export default async function SlideCategoriesPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("slide_categories")
    .select("id, name, slug, description, parent_id")
    .order("name");

  const byId = new Map((categories ?? []).map((c) => [c.id, c]));
  const topLevel = (categories ?? []).filter((c) => !c.parent_id);

  return (
    <div>
      <h1 className="text-xl font-semibold">Slide Categories</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Two-level hierarchy: Syndrome Group → Diagnosis.
      </p>

      <div className="mt-6 rounded-lg border border-neutral-200 p-4">
        <CategoryForm parents={topLevel} />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Parent</th>
              <th className="px-4 py-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {(categories ?? []).map((c) => (
              <tr key={c.id} className="border-t border-neutral-200">
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2 text-neutral-500">
                  {c.parent_id ? byId.get(c.parent_id)?.name : "—"}
                </td>
                <td className="px-4 py-2 text-neutral-500">
                  {c.description ?? "—"}
                </td>
              </tr>
            ))}
            {(categories ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">
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
