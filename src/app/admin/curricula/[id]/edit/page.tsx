import { createClient } from "@/lib/supabase/server";
import { DetailsForm } from "../details-form";
import { updatePathwayDetails } from "../actions";

export default async function EditCurriculumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pathway } = await supabase
    .from("curricula")
    .select(
      "id, title, level, pass_threshold, description, pathway_type, learning_outcomes, certificate_awarded, certificate_title, cpd_points, estimated_completion_minutes, version",
    )
    .eq("id", id)
    .single();

  if (!pathway) {
    return <p className="text-sm text-ink-dim">Learning pathway not found.</p>;
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">Edit details</h1>
      <div className="mt-6">
        <DetailsForm
          pathway={pathway}
          action={updatePathwayDetails}
          cancelHref={`/admin/curricula/${pathway.id}`}
        />
      </div>
    </div>
  );
}
