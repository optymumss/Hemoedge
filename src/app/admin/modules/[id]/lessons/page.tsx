import { createClient } from "@/lib/supabase/server";
import { LessonForm } from "./lesson-form";
import { LessonRow } from "./lesson-row";

export default async function ModuleLessonsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: module_ } = await supabase
    .from("modules")
    .select("id, title")
    .eq("id", id)
    .single();

  if (!module_) {
    return <p className="text-sm text-ink-dim">Module not found.</p>;
  }

  const [{ data: lessons }, { data: slides }] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, title, body, slide_id")
      .eq("module_id", id)
      .order("position"),
    supabase.from("slides").select("id, title").order("title"),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold">{module_.title} — Lessons</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Ordered content units learners work through. Link a slide to embed the WSI viewer.
      </p>

      <div className="mt-6 rounded-lg border border-line p-4">
        <LessonForm moduleId={module_.id} slides={slides ?? []} />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {(lessons ?? []).map((lesson, i) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            moduleId={module_.id}
            slides={slides ?? []}
            index={i}
            total={(lessons ?? []).length}
          />
        ))}
        {(lessons ?? []).length === 0 && (
          <p className="py-6 text-center text-sm text-ink-faint">No lessons yet.</p>
        )}
      </div>
    </div>
  );
}
