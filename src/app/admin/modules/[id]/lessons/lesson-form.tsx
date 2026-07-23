"use client";

import { useActionState } from "react";
import { addLesson, type FormState } from "./actions";

export function LessonForm({
  moduleId,
  slides,
}: {
  moduleId: string;
  slides: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addLesson,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="module_id" value={moduleId} />
      <input
        name="title"
        required
        placeholder="Lesson title"
        className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
      />
      <textarea
        name="body"
        rows={4}
        placeholder="Lesson content (optional)"
        className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
      />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="lesson-slide">
          Link a slide (optional, embeds the WSI viewer for learners)
        </label>
        <select
          id="lesson-slide"
          name="slide_id"
          defaultValue=""
          className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
        >
          <option value="">No slide</option>
          {slides.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add lesson"}
      </button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
