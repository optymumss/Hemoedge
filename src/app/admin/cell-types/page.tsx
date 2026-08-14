import { createClient } from "@/lib/supabase/server";
import { CellTypeForm } from "./cell-type-form";
import { CellTypesTable } from "./cell-types-table";

export default async function CellTypesPage() {
  const supabase = await createClient();
  const { data: cellTypes } = await supabase
    .from("cell_types")
    .select("id, name, code, lineage, description, is_wbc_diff_countable")
    .order("name");

  return (
    <div>
      <h1 className="text-xl font-semibold">Cell Types</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Powers slide tagging, Feature Library tagging, search, filtering, and learner navigation.
      </p>

      <div className="mt-6 rounded-lg border border-line p-4">
        <CellTypeForm />
      </div>

      <div className="mt-6">
        <CellTypesTable rows={cellTypes ?? []} />
      </div>
    </div>
  );
}
