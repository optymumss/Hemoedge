import { createClient } from "@/lib/supabase/server";
import { CategoryForm } from "./category-form";
import { CategoriesTable, type CategoryRow } from "./categories-table";

export default async function SlideCategoriesPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("slide_categories")
    .select("id, name, slug, description, parent_id")
    .order("name");

  const byId = new Map((categories ?? []).map((c) => [c.id, c]));
  const topLevel = (categories ?? []).filter((c) => !c.parent_id);

  const rows: CategoryRow[] = (categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    parentName: c.parent_id ? byId.get(c.parent_id)?.name ?? null : null,
    description: c.description,
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold">Slide Categories</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Two-level hierarchy: Syndrome Group → Diagnosis.
      </p>

      <div className="mt-6 rounded-lg border border-line p-4">
        <CategoryForm parents={topLevel} />
      </div>

      <div className="mt-6">
        <CategoriesTable rows={rows} />
      </div>
    </div>
  );
}
