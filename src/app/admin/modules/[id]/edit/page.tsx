import { createClient } from "@/lib/supabase/server";
import { DetailsForm } from "../details-form";
import { updateModuleDetails } from "../actions";

export default async function EditModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: module_ } = await supabase
    .from("modules")
    .select(
      "id, title, level, description, module_type, learning_objectives, teaching_notes, estimated_duration_minutes, cpd_points, audio_path, audio_transcript, video_path",
    )
    .eq("id", id)
    .single();

  if (!module_) {
    return <p className="text-sm text-ink-dim">Module not found.</p>;
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">Edit details</h1>
      <div className="mt-6">
        <DetailsForm
          module_={module_}
          action={updateModuleDetails}
          cancelHref={`/admin/modules/${module_.id}`}
        />
      </div>
    </div>
  );
}
