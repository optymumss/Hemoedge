import { createClient } from "@/lib/supabase/server";
import { FeatureForm } from "../feature-form";

export default async function NewFeaturePage() {
  const supabase = await createClient();
  const { data: cellTypes } = await supabase.from("cell_types").select("id, name").order("name");

  return (
    <div>
      <h1 className="text-xl font-semibold">New feature</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Fill in the feature&apos;s details, then Save to create it as a draft.
      </p>

      <div className="mt-6 rounded-lg border border-line p-4">
        <FeatureForm cellTypes={cellTypes ?? []} />
      </div>
    </div>
  );
}
