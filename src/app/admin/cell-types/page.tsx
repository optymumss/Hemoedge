import { createClient } from "@/lib/supabase/server";
import { CellTypeForm } from "./cell-type-form";

const LINEAGE_LABEL: Record<string, string> = {
  red_cell: "Red Cell",
  white_cell: "White Cell",
  platelet: "Platelet",
};

export default async function CellTypesPage() {
  const supabase = await createClient();
  const { data: cellTypes } = await supabase
    .from("cell_types")
    .select("id, name, code, lineage")
    .order("name");

  return (
    <div>
      <h1 className="text-xl font-semibold">Cell Types</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Powers slide tagging, the Feature Library, and the WBC diff counter.
      </p>

      <div className="mt-6 rounded-lg border border-neutral-200 p-4">
        <CellTypeForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Lineage</th>
            </tr>
          </thead>
          <tbody>
            {(cellTypes ?? []).map((c) => (
              <tr key={c.id} className="border-t border-neutral-200">
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2">
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-mono">
                    {c.code}
                  </span>
                </td>
                <td className="px-4 py-2 text-neutral-500">
                  {LINEAGE_LABEL[c.lineage] ?? c.lineage}
                </td>
              </tr>
            ))}
            {(cellTypes ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">
                  No cell types yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
