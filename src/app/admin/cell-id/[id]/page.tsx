import { createClient } from "@/lib/supabase/server";
import { DetailsForm } from "./details-form";

export default async function ExerciseDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: exercise }, { data: slides }, { data: modules }, { data: cases }] =
    await Promise.all([
      supabase
        .from("cell_id_exercises")
        .select("id, title, level, slide_id, module_id, case_id, instructions, cpd_points")
        .eq("id", id)
        .single(),
      supabase.from("slides").select("id, title").order("title"),
      supabase.from("modules").select("id, title").order("title"),
      supabase.from("cases").select("id, title").order("title"),
    ]);

  if (!exercise) {
    return <p className="text-sm text-ink-dim">Exercise not found.</p>;
  }

  return (
    <div>
      <p className="text-sm text-ink-dim">
        Core exercise fields and optional module/case attachment.
      </p>
      <div className="mt-6">
        <DetailsForm
          exercise={exercise}
          slides={slides ?? []}
          modules={modules ?? []}
          cases={cases ?? []}
        />
      </div>
    </div>
  );
}
