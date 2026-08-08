import { createClient } from "@/lib/supabase/server";
import { ExerciseTabs } from "./tabs";

export default async function ExerciseLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: exercise } = await supabase
    .from("wbc_diff_exercises")
    .select("id, title")
    .eq("id", id)
    .single();

  if (!exercise) {
    return <p className="text-sm text-ink-dim">Exercise not found.</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">{exercise.title}</h1>
      <div className="mt-4">
        <ExerciseTabs exerciseId={exercise.id} />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
