import { createClient } from "@/lib/supabase/server";
import { DetailsForm } from "../details-form";
import { updateCaseDetails } from "../actions";

export default async function EditCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: case_ }, { data: slides }] = await Promise.all([
    supabase
      .from("cases")
      .select(
        "id, title, level, description, slide_id, case_context, lab_values, final_diagnosis, learning_points, estimated_time_minutes, cpd_points, case_category, escalation_decision, suggested_report_comment, audio_path, audio_transcript, video_path",
      )
      .eq("id", id)
      .single(),
    supabase.from("slides").select("id, title").order("title"),
  ]);

  if (!case_) {
    return <p className="text-sm text-ink-dim">Case study not found.</p>;
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">Edit details</h1>
      <div className="mt-6">
        <DetailsForm case_={case_} slides={slides ?? []} action={updateCaseDetails} />
      </div>
    </div>
  );
}
